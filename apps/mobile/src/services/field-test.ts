import { uuid } from 'expo';
import type { CommunityPreferences, FieldTestSession } from '@civic263/domain';
import { stopFieldTestSafely } from './field-test-stop';
import { communityCall, getCommunityProfile, saveCommunityPreferences } from './community';
import { currentResolutionFix } from './resolution-evidence';
import { readAlertState, updateAlertState } from './alert-storage';
import {
  applyCommunityPreferences,
  prepareCommunityPreferences,
  reconcileCommunityRuntime,
} from './nearby-alerts';
export const isAcceptanceBuild = process.env.EXPO_PUBLIC_APP_ENV === 'acceptance';
export async function readOwnFieldTest() {
  return (
    await communityCall<{ session: FieldTestSession | null }>('community-field-test', {
      operation: 'state',
    })
  ).session;
}
export async function startOwnFieldTest() {
  if (!isAcceptanceBuild) throw new Error('Use the private Civic263 Test build.');
  const profile = await getCommunityProfile();
  if (!profile.testIdentity)
    throw new Error('This identity has not been authorised for private field testing.');
  const prepared = await prepareCommunityPreferences(
    { ...profile.preferences, nearbyAlerts: true, backgroundAlerts: true },
    profile.preferences,
  );
  if (!prepared.preferences.backgroundAlerts)
    throw new Error('Allow background location before starting this test.');
  await saveCommunityPreferences(prepared.preferences);
  await applyCommunityPreferences(prepared.preferences);
  const location = await currentResolutionFix();
  const { session } = await communityCall<{ session: FieldTestSession }>('community-field-test', {
    operation: 'start',
    attemptId: uuid.v4(),
    location,
  });
  await updateAlertState((state) => {
    state.fieldTest = session;
    delete state.fieldTestCleanupPending;
    state.refreshedAt = 0;
  });
  await reconcileCommunityRuntime();
  return session;
}
export async function refreshOwnFieldTest() {
  const session = await readOwnFieldTest();
  await updateAlertState((state) => {
    if (session) state.fieldTest = session;
    else delete state.fieldTest;
  });
  return session;
}
export async function stopOwnFieldTest() {
  let next: CommunityPreferences | undefined;
  return stopFieldTestSafely({
    async pauseLocally() {
      // Local pause first: no network call may precede it, so an expired grant or lost
      // connection cannot leave background/geofence work running.
      const state = await readAlertState();
      next = { ...state.preferences, nearbyAlerts: false, backgroundAlerts: false };
      await prepareCommunityPreferences(next, state.preferences);
      await applyCommunityPreferences(next);
      await updateAlertState((current) => {
        delete current.fieldTest;
      });
    },
    async stopRemotely() {
      await communityCall('community-field-test', { operation: 'stop' });
      if (next) await saveCommunityPreferences(next);
    },
    async recordRemoteCleanup(pending) {
      await updateAlertState((state) => {
        if (pending) state.fieldTestCleanupPending = true;
        else delete state.fieldTestCleanupPending;
      });
    },
  });
}
export async function readFieldTestCleanupPending() {
  return (await readAlertState()).fieldTestCleanupPending === true;
}
