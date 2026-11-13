import { Directory, File, Paths } from 'expo-file-system';
import { reload, sendEmailVerification } from 'firebase/auth';
import { DEFAULT_COMMUNITY_PREFERENCES } from '@civic263/domain';
import { residentServices } from './firebase';
import { loadDrafts } from './drafts';
import { listMyReports, invalidateNearbyReports } from './reports';
import { getMyVisits } from './community';
import { readAlertState, updateAlertState } from './alert-storage';
import { applyCommunityPreferences, prepareCommunityPreferences } from './nearby-alerts';
import {
  linkResidentIdentity,
  restoreResidentIdentity,
  requestResidentPasswordReset,
} from './identity-commands';

export async function residentAccount() {
  const { auth } = await residentServices();
  const user = auth.currentUser!;
  return {
    anonymous: user.isAnonymous,
    accountReference: process.env.EXPO_PUBLIC_APP_ENV === 'acceptance' ? user.uid : null,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}
export async function saveResidentIdentity(email: string, password: string) {
  const { auth } = await residentServices();
  await linkResidentIdentity(auth, email, password);
  return residentAccount();
}
export async function signInResident(email: string, password: string) {
  const { auth } = await residentServices();
  const [drafts, reports, visits] = await Promise.all([
    loadDrafts(),
    listMyReports(),
    getMyVisits(),
  ]);
  const evidence = new Directory(Paths.document, 'civic263-resolutions');
  let unsent = false;
  if (evidence.exists)
    for (const file of evidence.list()) {
      if (file instanceof File && file.name.endsWith('.json')) {
        const draft = JSON.parse(await file.text()) as { photos?: unknown[]; pending?: unknown };
        if (draft.pending || draft.photos?.length) unsent = true;
      }
    }
  const ownsWork = !!(
    drafts.drafts.length ||
    drafts.unreadableCount ||
    reports.reports.length ||
    visits.items.length ||
    unsent
  );
  if (ownsWork)
    throw new Error(
      'Save this device identity with an email first. Its reports and drafts cannot be merged automatically.',
    );
  const previous = await readAlertState();
  await prepareCommunityPreferences({ ...DEFAULT_COMMUNITY_PREFERENCES }, previous.preferences);
  await applyCommunityPreferences({ ...DEFAULT_COMMUNITY_PREFERENCES });
  await updateAlertState((state) => {
    delete state.fieldTest;
    state.targets = [];
    state.ownFixIds = [];
    state.ledger = { day: '', count: 0, issues: {} };
    state.centre = null;
    state.refreshedAt = 0;
  });
  await restoreResidentIdentity(auth, email, password, false);
  invalidateNearbyReports();
  return residentAccount();
}
export async function resetResidentPassword(email: string) {
  const { auth } = await residentServices();
  await requestResidentPasswordReset(auth, email);
}
export async function verifyResidentEmail() {
  const { auth } = await residentServices();
  if (auth.currentUser?.email) await sendEmailVerification(auth.currentUser);
}
export async function refreshResidentAccount() {
  const { auth } = await residentServices();
  await reload(auth.currentUser!);
  await auth.currentUser!.getIdToken(true);
  return residentAccount();
}
