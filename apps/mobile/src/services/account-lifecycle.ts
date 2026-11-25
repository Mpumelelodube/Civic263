import { Directory, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { signOut } from 'firebase/auth';
import {
  DEFAULT_COMMUNITY_PREFERENCES,
  type AccountDeletionResult,
  type CorrectionReceipt,
  type ReportCorrectionInput,
  type WithdrawalReceipt,
} from '@civic263/domain';
import { communityCall } from './community';
import { residentServices } from './firebase';
import { invalidateNearbyReports } from './reports';
import { readAlertState, updateAlertState } from './alert-storage';
import { applyCommunityPreferences, prepareCommunityPreferences } from './nearby-alerts';

export async function withdrawMyReport(reportId: string) {
  const receipt = await communityCall<WithdrawalReceipt>('withdraw-report', { reportId });
  if (receipt?.reportId !== reportId)
    throw new Error('Could not confirm the withdrawal. Refresh this report and retry.');
  invalidateNearbyReports();
  return receipt;
}

export async function correctMyReport(input: ReportCorrectionInput) {
  const receipt = await communityCall<CorrectionReceipt>('correct-report', { ...input });
  if (receipt?.reportId !== input.reportId || receipt.revision !== input.revision + 1)
    throw new Error('Could not confirm the correction. Refresh this report and retry.');
  return receipt;
}

// Everything this device stores for the resident; all of it belongs to the deleted identity.
const LOCAL_DIRECTORIES = [
  'civic263-drafts',
  'civic263-photos',
  'civic263-resolutions',
  'civic263-alerts',
  'civic263-demo-alerts',
];

/** Stops reminders, background location and push on this device before any server call. */
async function pauseThisDevice() {
  const state = await readAlertState();
  // Treat push as already off so pausing never needs the network; the server erases devices.
  await prepareCommunityPreferences(
    { ...DEFAULT_COMMUNITY_PREFERENCES },
    { ...state.preferences, pushUpdates: false },
  );
  await applyCommunityPreferences({ ...DEFAULT_COMMUNITY_PREFERENCES });
  await updateAlertState((current) => {
    delete current.fieldTest;
    current.targets = [];
  });
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

async function eraseThisDevice() {
  await Notifications.dismissAllNotificationsAsync().catch(() => {});
  for (const name of LOCAL_DIRECTORIES) {
    const directory = new Directory(Paths.document, name);
    if (directory.exists) directory.delete();
  }
  invalidateNearbyReports();
  const { auth } = await residentServices();
  await signOut(auth);
}

/**
 * Deletes the resident's account. The device pauses first, so an offline or failed request
 * leaves it quiet; local data is erased only after the server confirms completion.
 */
export async function deleteMyAccount() {
  await pauseThisDevice();
  let result: AccountDeletionResult = { status: 'partial' };
  for (let attempt = 0; attempt < 6 && result.status !== 'complete'; attempt += 1)
    result = await communityCall<AccountDeletionResult>('delete-account', { confirm: 'DELETE' });
  if (result.status !== 'complete')
    throw new Error(
      'Account deletion is taking longer than expected. Keep the app open and retry.',
    );
  await eraseThisDevice();
}
