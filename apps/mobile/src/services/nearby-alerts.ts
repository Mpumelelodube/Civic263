import { AppState, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import {
  COMMUNITY_ID,
  REVIEW_REMINDER_RADIUS_METRES,
  distanceKm,
  eligibleReminder,
  maySendReminder,
  nearbyReminderTargets,
  recordReminder,
  type CommunityPreferences,
  type PublicIncident,
  type FieldTestSession,
} from '@civic263/domain';
import { communityCall, getCommunityProfile, getMyVisits } from './community';
import { readNearbyReports, readPublicReport } from './reports';
import { readAlertState, updateAlertState } from './alert-storage';
import { appleFcmToken } from './native-firebase';

const MOVEMENT_TASK = 'civic263-nearby-review-movement';
const GEOFENCE_TASK = 'civic263-nearby-review-entry';
let foreground: Location.LocationSubscription | undefined;
let refresh: AbortController | undefined;
let locating = false;
let preferenceRevision = 0;
let immediatelyPaused = false;
let processing: Promise<unknown> = Promise.resolve();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export async function communityChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('community-updates', {
      name: 'Report and review updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150],
    });
    await Notifications.setNotificationChannelAsync('nearby-reviews', {
      name: 'Nearby review invitations',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150, 100, 150],
    });
  }
}
async function permissionForNotifications() {
  await communityChannels();
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (
    !permission.granted &&
    permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
  )
    throw new Error('Allow notifications in phone settings to receive these reminders.');
}
async function stopBackground() {
  if (isRunningInExpoGo() || Platform.OS === 'web') return;
  for (const task of [MOVEMENT_TASK, GEOFENCE_TASK]) {
    if (!(await TaskManager.isTaskRegisteredAsync(task))) continue;
    try {
      if (task === MOVEMENT_TASK) await Location.stopLocationUpdatesAsync(task);
      else await Location.stopGeofencingAsync(task);
    } catch {
      // A revoked location grant must still allow a resident to pause their tasks.
      await TaskManager.unregisterTaskAsync(task);
    }
  }
}
export async function prepareCommunityPreferences(
  next: CommunityPreferences,
  previous: CommunityPreferences,
) {
  preferenceRevision++;
  if (!next.pushUpdates)
    await updateAlertState((state) => {
      state.devicePushPaused = true;
      state.preferences.pushUpdates = false;
    });
  if (!next.nearbyAlerts) {
    immediatelyPaused = true;
    refresh?.abort();
    foreground?.remove();
    foreground = undefined;
    await updateAlertState((state) => {
      state.devicePaused = true;
      state.deviceBackgroundPaused = true;
      state.preferences = { ...state.preferences, nearbyAlerts: false, backgroundAlerts: false };
    });
    await stopBackground();
  } else if (!next.backgroundAlerts && previous.backgroundAlerts) {
    await updateAlertState((state) => {
      state.deviceBackgroundPaused = true;
      state.preferences.backgroundAlerts = false;
    });
    await stopBackground();
  }
  const enablingBackground = next.backgroundAlerts && !previous.backgroundAlerts;
  if (enablingBackground && isRunningInExpoGo())
    throw new Error(
      'Background reminders need the installed Civic263 test app. Nearby reminders can be used while Expo Go is open.',
    );
  if (next.nearbyAlerts && (!previous.nearbyAlerts || enablingBackground)) {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (
      !permission.granted ||
      permission.android?.accuracy === 'coarse' ||
      permission.ios?.accuracy === 'reduced'
    )
      throw new Error('Allow precise location to enable nearby review reminders.');
    await permissionForNotifications();
  }
  let notice: string | null = null;
  if (enablingBackground) {
    if (!(await TaskManager.isAvailableAsync()))
      throw new Error('Background reminders are unavailable in this app build.');
    if (!(await Location.requestBackgroundPermissionsAsync()).granted) {
      next = { ...next, backgroundAlerts: false };
      notice =
        'Background location was not allowed. Reminders can still work while Civic263 is open.';
    }
  }
  if (next.pushUpdates && !previous.pushUpdates) {
    if (isRunningInExpoGo())
      throw new Error(
        'Push updates need the installed Civic263 app. Your updates are always available in the community inbox.',
      );
    await permissionForNotifications();
    await registerCommunityPushToken();
  } else if (!next.pushUpdates && previous.pushUpdates) {
    const state = await readAlertState();
    await communityCall('community-unregister-push', { installationId: state.installationId });
  }
  return { preferences: next, notice };
}
export async function registerCommunityPushToken(token?: Notifications.DevicePushToken) {
  if (isRunningInExpoGo() || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return;
  const permission = await Notifications.getPermissionsAsync();
  if (
    !permission.granted &&
    permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
  )
    return;
  const device = token ?? (await Notifications.getDevicePushTokenAsync());
  const fcm =
    Platform.OS === 'ios' ? await appleFcmToken(String(device.data)) : String(device.data);
  const state = await readAlertState();
  await communityCall('community-register-push', {
    installationId: state.installationId,
    platform: Platform.OS,
    token: fcm,
  });
}
export async function applyCommunityPreferences(preferences: CommunityPreferences) {
  immediatelyPaused = !preferences.nearbyAlerts;
  await updateAlertState((state) => {
    state.preferences = preferences;
    state.devicePaused = !preferences.nearbyAlerts;
    state.devicePushPaused = !preferences.pushUpdates;
    state.deviceBackgroundPaused = !preferences.backgroundAlerts;
  });
  await reconcileCommunityRuntime();
}
async function notify(issue: PublicIncident) {
  if (immediatelyPaused) return;
  await updateAlertState(async (state) => {
    if (
      immediatelyPaused ||
      !eligibleReminder(issue, state.preferences, state.ownFixIds) ||
      !maySendReminder(issue.id, state.ledger)
    )
      return;
    const pending = issue.communityResolution?.status === 'awaiting-confirmation';
    await Notifications.scheduleNotificationAsync({
      identifier: `nearby-${issue.id}`,
      content: {
        title: pending ? 'A nearby fix needs a second look' : 'Can you check a nearby issue?',
        body: pending
          ? 'A resident reported a fix nearby. Visit the site when convenient to confirm its condition.'
          : 'If you can visit safely, check whether this published issue has been fixed.',
        data: { reportId: issue.id },
        sound: 'default',
      },
      trigger: Platform.OS === 'android' ? { channelId: 'nearby-reviews' } : null,
    });
    state.ledger = recordReminder(issue.id, state.ledger);
  });
}
async function refreshGeofences(targets: PublicIncident[], enabled: boolean) {
  if (!enabled || isRunningInExpoGo() || Platform.OS === 'web') return;
  const state = await readAlertState();
  const regions = targets.map((issue) => ({
    identifier: issue.id,
    latitude: issue.location!.latitude,
    longitude: issue.location!.longitude,
    radius: REVIEW_REMINDER_RADIUS_METRES,
    notifyOnEnter: true,
    notifyOnExit: false,
  }));
  if (
    process.env.EXPO_PUBLIC_APP_ENV === 'acceptance' &&
    state.fieldTest &&
    Date.parse(state.fieldTest.expiresAt) > Date.now()
  )
    regions.push({
      identifier: 'test:' + state.fieldTest.id,
      ...state.fieldTest.location,
      radius: REVIEW_REMINDER_RADIUS_METRES,
      notifyOnEnter: true,
      notifyOnExit: true,
    });
  if (!regions.length) {
    if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK))
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    return;
  }
  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
}
async function fieldTestSignal(testId: string, kind: 'left' | 'entered') {
  const state = await readAlertState();
  if (
    immediatelyPaused ||
    !state.preferences.backgroundAlerts ||
    !state.preferences.nearbyAlerts ||
    state.fieldTest?.id !== testId
  )
    return;
  const { session } = await communityCall<{ session: FieldTestSession | null }>(
    'community-field-test',
    { operation: 'event', testId, kind, source: 'geofence' },
  );
  let sent = false;
  await updateAlertState(async (current) => {
    if (
      !session ||
      current.fieldTest?.id !== testId ||
      immediatelyPaused ||
      !current.preferences.backgroundAlerts
    )
      return;
    current.fieldTest = session;
    if (session.status === 'returned' && maySendReminder(testId, current.ledger)) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'field-test-' + testId,
        content: {
          title: 'Civic263 field test passed',
          body: 'The phone detected your return to the private 200 m test area. No civic report was created.',
          data: { fieldTestId: testId },
          sound: 'default',
        },
        trigger: Platform.OS === 'android' ? { channelId: 'nearby-reviews' } : null,
      });
      current.ledger = recordReminder(testId, current.ledger);
      sent = true;
    }
  });
  if (sent) {
    const done = await communityCall<{ session: FieldTestSession | null }>('community-field-test', {
      operation: 'event',
      testId,
      kind: 'notified',
      source: 'geofence',
    });
    await updateAlertState((current) => {
      if (done.session && current.fieldTest?.id === testId) current.fieldTest = done.session;
    });
  }
}
async function processPosition(point: Location.LocationObject) {
  let state = await readAlertState();
  if (
    immediatelyPaused ||
    !state.preferences.nearbyAlerts ||
    (!state.preferences.backgroundAlerts && AppState.currentState !== 'active') ||
    point.mocked ||
    point.timestamp < Date.now() - 120000 ||
    (point.coords.accuracy ?? Infinity) > 100
  )
    return;
  const centre = point.coords;
  if (
    !state.centre ||
    Date.now() - state.refreshedAt > 900000 ||
    (Date.now() - state.refreshedAt > 120000 && distanceKm(state.centre, centre) >= 1)
  ) {
    refresh?.abort();
    const abort = new AbortController();
    refresh = abort;
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const searchCentre = {
        latitude: Math.round(centre.latitude * 100) / 100,
        longitude: Math.round(centre.longitude * 100) / 100,
      };
      const result = await readNearbyReports(searchCentre, abort.signal);
      state = await updateAlertState((current) => {
        current.targets = nearbyReminderTargets(
          result.incidents,
          centre,
          current.preferences,
          current.ownFixIds,
        );
        current.centre = { latitude: centre.latitude, longitude: centre.longitude };
        current.refreshedAt = Date.now();
      });
      if (!immediatelyPaused)
        await refreshGeofences(state.targets, state.preferences.backgroundAlerts);
    } catch {
      /* Offline reminders never assert a stale issue is still active. */ return;
    } finally {
      clearTimeout(timeout);
    }
  }
  for (const candidate of state.targets) {
    if (immediatelyPaused) return;
    if (
      candidate.location &&
      distanceKm(centre, candidate.location) * 1000 <= REVIEW_REMINDER_RADIUS_METRES
    ) {
      try {
        const current = await readPublicReport(candidate.id, AbortSignal.timeout(10000));
        await notify(current);
      } catch {
        /* Withdrawn, closed or unavailable records produce no reminder. */
      }
    }
  }
}
function queuePosition(point: Location.LocationObject) {
  processing = processing.catch(() => {}).then(() => processPosition(point));
  return processing;
}
if (!TaskManager.isTaskDefined(MOVEMENT_TASK))
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    MOVEMENT_TASK,
    async ({ data, error }) => {
      if (!error && data?.locations?.length)
        await queuePosition(data.locations[data.locations.length - 1]!);
    },
  );
if (!TaskManager.isTaskDefined(GEOFENCE_TASK))
  TaskManager.defineTask<{
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  }>(GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data?.region.identifier) return;
    if (
      process.env.EXPO_PUBLIC_APP_ENV === 'acceptance' &&
      data.region.identifier.startsWith('test:')
    ) {
      const testId = data.region.identifier.slice(5);
      if (!COMMUNITY_ID.test(testId)) return;
      processing = processing
        .catch(() => {})
        .then(() =>
          fieldTestSignal(
            testId,
            data.eventType === Location.GeofencingEventType.Exit ? 'left' : 'entered',
          ),
        );
      await processing;
      return;
    }
    if (
      data.eventType !== Location.GeofencingEventType.Enter ||
      !COMMUNITY_ID.test(data.region.identifier)
    )
      return;
    const state = await readAlertState();
    if (!state.preferences.backgroundAlerts || !state.preferences.nearbyAlerts || immediatelyPaused)
      return;
    try {
      await notify(await readPublicReport(data.region.identifier, AbortSignal.timeout(10000)));
    } catch {
      /* No offline or unpublished reminder. */
    }
  });
export async function reconcileCommunityRuntime() {
  const state = await readAlertState();
  foreground?.remove();
  foreground = undefined;
  if (!state.preferences.nearbyAlerts) {
    await stopBackground();
    return;
  }
  if (!(await Location.getForegroundPermissionsAsync()).granted) {
    await stopBackground();
    return;
  }
  const notificationPermission = await Notifications.getPermissionsAsync();
  if (
    !notificationPermission.granted &&
    notificationPermission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    await stopBackground();
    return;
  }
  if (
    state.preferences.backgroundAlerts &&
    !isRunningInExpoGo() &&
    (await Location.getBackgroundPermissionsAsync()).granted
  ) {
    if (AppState.currentState === 'active')
      await Location.startLocationUpdatesAsync(MOVEMENT_TASK, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 100,
        timeInterval: 60000,
        deferredUpdatesDistance: 100,
        deferredUpdatesInterval: 60000,
        pausesUpdatesAutomatically: true,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Civic263 nearby reviews',
          notificationBody:
            'Looking for nearby review invitations. Pause in Community preferences.',
          killServiceOnDestroy: false,
        },
      });
    await refreshGeofences(state.targets, true);
  } else {
    await stopBackground();
    if (AppState.currentState === 'active')
      foreground = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 60000 },
        (point) => {
          void queuePosition(point).catch(() => {});
        },
      );
  }
  if (!locating && AppState.currentState === 'active') {
    locating = true;
    void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((point) => queuePosition(point))
      .catch(() => {})
      .finally(() => {
        locating = false;
      });
  }
}
export async function syncCommunityRuntime() {
  const revision = preferenceRevision;
  const [profile, visits] = await Promise.all([getCommunityProfile(), getMyVisits()]);
  if (revision !== preferenceRevision) return;
  await updateAlertState((state) => {
    state.preferences = profile.preferences;
    state.ownFixIds = [
      ...new Set([
        ...visits.items.filter((item) => item.kind === 'report-fix').map((item) => item.id),
        ...state.ownFixIds,
      ]),
    ].slice(0, 100);
  });
  if (profile.preferences.pushUpdates) await registerCommunityPushToken().catch(() => {});
  immediatelyPaused = !profile.preferences.nearbyAlerts;
  await reconcileCommunityRuntime();
}
