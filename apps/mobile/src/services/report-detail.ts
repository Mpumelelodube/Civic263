import type { PublicIncident, ResidentReportDetail } from '@civic263/domain';

export class PublicReportNotFoundError extends Error {}

export type ReportDetail =
  { kind: 'owner'; item: ResidentReportDetail } | { kind: 'public'; item: PublicIncident };

export async function loadReportDetail(
  view: 'owner' | 'public',
  readOwner: () => Promise<ResidentReportDetail>,
  readPublic: () => Promise<PublicIncident>,
  signal?: AbortSignal,
): Promise<ReportDetail> {
  if (view === 'owner') return { kind: 'owner', item: await readOwner() };
  try {
    return { kind: 'public', item: await readPublic() };
  } catch (error) {
    if (!(error instanceof PublicReportNotFoundError) || signal?.aborted) throw error;
    // A withdrawn public link can still belong to this resident; the server checks ownership.
    return { kind: 'owner', item: await readOwner() };
  }
}
