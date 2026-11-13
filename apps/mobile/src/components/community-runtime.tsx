import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { COMMUNITY_ID } from '@civic263/domain';
import { readCommunityNotification } from '@/services/community';
import { readAlertState } from '@/services/alert-storage';
import {
  communityChannels,
  registerCommunityPushToken,
  reconcileCommunityRuntime,
  syncCommunityRuntime,
} from '@/services/nearby-alerts';

export function CommunityRuntime() {
  useEffect(() => {
    let active = true;
    let lastResponse = '';
    const refresh = () => {
      if (active) void syncCommunityRuntime().catch(() => {});
    };
    void communityChannels().catch(() => {});
    refresh();
    const state = AppState.addEventListener('change', (value) => {
      if (value === 'active') refresh();
      else void reconcileCommunityRuntime().catch(() => {});
    });
    const open = (response: Notifications.NotificationResponse) => {
      if (!active || lastResponse === response.notification.request.identifier) return;
      const data = response.notification.request.content.data;
      if (
        process.env.EXPO_PUBLIC_APP_ENV === 'acceptance' &&
        typeof data?.fieldTestId === 'string' &&
        COMMUNITY_ID.test(data.fieldTestId)
      ) {
        router.push('/field-test');
        void Notifications.clearLastNotificationResponseAsync().catch(() => {});
        return;
      }
      if (typeof data?.reportId === 'string' && COMMUNITY_ID.test(data.reportId)) {
        lastResponse = response.notification.request.identifier;
        if (typeof data.notificationId === 'string' && COMMUNITY_ID.test(data.notificationId))
          void readCommunityNotification(data.notificationId).catch(() => {});
        router.push({ pathname: '/report-details', params: { id: data.reportId, view: 'public' } });
        void Notifications.clearLastNotificationResponseAsync().catch(() => {});
      }
    };
    const responses = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync()
      .then((value) => {
        if (value) open(value);
      })
      .catch(() => {});
    const tokens =
      (Platform.OS === 'android' || Platform.OS === 'ios') && !isRunningInExpoGo()
        ? Notifications.addPushTokenListener((token) => {
            void readAlertState()
              .then(async (state) => {
                if (state.preferences.pushUpdates) await registerCommunityPushToken(token);
              })
              .catch(() => {});
          })
        : null;
    return () => {
      active = false;
      state.remove();
      responses.remove();
      tokens?.remove();
    };
  }, []);
  return null;
}
