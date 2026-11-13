import { httpsCallable } from 'firebase/functions';
import type {
  CommunityContext,
  CommunityPreferences,
  CommunityVisit,
  PublicFieldCheck,
  ResidentNotification,
  ResolutionFix,
} from '@civic263/domain';
import { residentServices } from './firebase';
import { PUBLIC_API } from './reports';
import { effectiveReminderPreferences } from '@civic263/domain';
import { readAlertState } from './alert-storage';

export async function communityCall<T>(
  action: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const { functions } = await residentServices();
  return (
    await httpsCallable<Record<string, unknown>, T>(functions, 'submitReport', { timeout: 60000 })({
      action,
      ...data,
    })
  ).data;
}
export const getCommunityProfile = async () => {
  if (process.env.EXPO_PUBLIC_APP_ENV === 'acceptance') {
    const { auth } = await residentServices();
    await auth.currentUser?.getIdToken(true);
  }
  return communityCall<{ preferences: CommunityPreferences; testIdentity?: boolean }>(
    'community-profile',
  ).then(async (result) => {
    const state = await readAlertState();
    return {
      testIdentity: result.testIdentity === true,
      preferences: effectiveReminderPreferences(
        result.preferences,
        state.devicePaused,
        state.deviceBackgroundPaused,
        state.devicePushPaused,
      ),
    };
  });
};
export const saveCommunityPreferences = (preferences: CommunityPreferences) =>
  communityCall<{ preferences: CommunityPreferences }>('community-preferences', { preferences });
export const getCommunityContext = (reportId: string, location?: ResolutionFix) =>
  communityCall<CommunityContext>('community-context', {
    reportId,
    ...(location ? { location } : {}),
  });
export const getCommunityInbox = (cursor?: string) =>
  communityCall<{ items: ResidentNotification[]; nextCursor: string | null }>(
    'community-inbox',
    cursor ? { cursor } : {},
  );
export const getMyVisits = (cursor?: string) =>
  communityCall<{ items: CommunityVisit[]; nextCursor: string | null }>(
    'community-visits',
    cursor ? { cursor } : {},
  );
export const readCommunityNotification = (notificationId: string) =>
  communityCall('community-read', { notificationId });
export const readMyVisit = (checkId: string) =>
  communityCall<Omit<CommunityVisit, 'ownPhotoCount'> & { photos: { base64: string }[] }>(
    'community-visit',
    { checkId },
  );
export const fieldCheckPhotoUrl = (reportId: string, checkId: string, index: number) =>
  `${PUBLIC_API}/incidents/${reportId}/checks/${checkId}/photos/${index}`;
export async function readFieldChecks(reportId: string, signal?: AbortSignal, cursor?: string) {
  const response = await fetch(
    `${PUBLIC_API}/incidents/${reportId}/checks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    { signal: signal ?? null, headers: { 'Cache-Control': 'no-cache' } },
  );
  if (!response.ok) throw new Error('Could not load the community visit history.');
  return response.json() as Promise<{ items: PublicFieldCheck[]; nextCursor: string | null }>;
}
