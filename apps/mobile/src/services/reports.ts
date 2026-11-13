import { httpsCallable } from 'firebase/functions';
import type {
  PublicIncident,
  PublicIncidentResponse,
  ResidentReport,
  ResidentReportDetail,
  IssueLocation,
  CommunityReceipt,
  CommunityCheckCommand,
} from '@civic263/domain';
import {
  distanceKm,
  isOpenIncident,
  readCommunityResolution,
  COMMUNITY_ID,
  WORKFLOW_LABELS,
} from '@civic263/domain';
import { residentServices } from './firebase';
import { rememberOwnFix } from './alert-storage';

export const PUBLIC_API = (
  process.env.EXPO_PUBLIC_PUBLIC_API_URL ||
  'https://europe-west1-civic263-df6ec.cloudfunctions.net/publicApi'
).replace(/\/$/, '');
export const publicPhotoUrl = (id: string, index: number) =>
  `${PUBLIC_API}/incidents/${id}/photos/${index}`;
export const publicResolutionPhotoUrl = (id: string, index: number) =>
  `${PUBLIC_API}/incidents/${id}/resolution-photos/${index}`;
export async function listMyReports(cursor?: string) {
  const { functions } = await residentServices();
  const result = await httpsCallable<
    { cursor?: string },
    { reports: ResidentReport[]; nextCursor: string | null }
  >(functions, 'getMyReports', { timeout: 20000 })(cursor ? { cursor } : {});
  return result.data;
}
export async function readMyReport(reportId: string) {
  const { functions } = await residentServices();
  return (
    await httpsCallable<{ reportId: string }, ResidentReportDetail>(functions, 'getMyReport', {
      timeout: 60000,
    })({ reportId })
  ).data;
}
export async function resolveMyReport(command: CommunityCheckCommand): Promise<CommunityReceipt> {
  const { reportId } = command;
  const { functions } = await residentServices();
  const result = (
    await httpsCallable<CommunityCheckCommand, CommunityReceipt>(functions, 'submitReport', {
      timeout: 70000,
    })(command)
  ).data;
  const communityResolution = readCommunityResolution(result?.communityResolution);
  if (
    result?.reportId !== reportId ||
    !COMMUNITY_ID.test(result.checkId) ||
    !Object.hasOwn(WORKFLOW_LABELS, result.workflowStatus) ||
    !communityResolution
  )
    throw new Error('Could not confirm the update. Refresh this report before trying again.');
  invalidateNearbyReports();
  if (command.action === 'report-fix') await rememberOwnFix(result.checkId).catch(() => {});
  return {
    reportId,
    checkId: result.checkId,
    workflowStatus: result.workflowStatus,
    communityResolution,
  };
}
export async function readPublicReport(id: string, signal?: AbortSignal): Promise<PublicIncident> {
  if (!/^[a-f0-9]{40}$/.test(id)) throw new Error('Published report not found.');
  const response = await fetch(`${PUBLIC_API}/incidents/${id}`, {
    signal: signal ?? null,
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? 'Published report not found.'
        : 'Could not load this report. Please retry.',
    );
  return response.json() as Promise<PublicIncident>;
}

export function invalidateNearbyReports() {
  nearbyCache.clear();
}
const nearbyCache = new Map<
  string,
  { at: number; incidents: PublicIncident[]; truncated: boolean }
>();
export async function readNearbyReports(centre: IssueLocation, signal: AbortSignal) {
  const key = `${centre.latitude.toFixed(4)},${centre.longitude.toFixed(4)}`;
  const cached = nearbyCache.get(key);
  if (cached && Date.now() - cached.at < 60000) return cached;
  const incidents = new Map<string, PublicIncident>();
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({
      lat: String(centre.latitude),
      lng: String(centre.longitude),
      ...(cursor ? { cursor } : {}),
    });
    const response = await fetch(`${PUBLIC_API}/incidents?${query}`, {
      signal: signal ?? null,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) throw new Error('Could not load nearby reports. Please retry.');
    const result = (await response.json()) as PublicIncidentResponse;
    if (!Array.isArray(result.incidents))
      throw new Error('Nearby reports returned an invalid response.');
    for (const item of result.incidents)
      if (isOpenIncident(item) && item.location && distanceKm(centre, item.location) <= 5)
        incidents.set(item.id, item);
    cursor = result.nextCursor;
    if (!cursor) break;
  }
  const value = { at: Date.now(), incidents: [...incidents.values()], truncated: cursor !== null };
  if (nearbyCache.size >= 20) nearbyCache.delete(nearbyCache.keys().next().value!);
  nearbyCache.set(key, value);
  return value;
}
