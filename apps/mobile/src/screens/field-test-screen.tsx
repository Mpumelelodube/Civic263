import { useCallback, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FieldTestSession } from '@civic263/domain';
import { AppText } from '@/components/app-text';
import { ActionButton, IconBadge } from '@/components/action-button';
import {
  isAcceptanceBuild,
  startOwnFieldTest,
  refreshOwnFieldTest,
  stopOwnFieldTest,
} from '@/services/field-test';
import { useTheme } from '@/theme';
export function FieldTestScreen() {
  const theme = useTheme(),
    insets = useSafeAreaInsets();
  const [session, setSession] = useState<FieldTestSession | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setSession(await refreshOwnFieldTest());
      setError(null);
    } catch {
      setError(
        'Could not load the private field test. It requires an authorised acceptance account.',
      );
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (!isAcceptanceBuild) return;
      void load();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void load();
      }, 10000);
      return () => clearInterval(timer);
    }, [load]),
  );
  async function run(start: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (start) setSession(await startOwnFieldTest());
      else {
        await stopOwnFieldTest();
        setSession(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update the test.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 32,
        gap: 20,
      }}
    >
      <ActionButton
        label="Back to reviews"
        icon="close"
        variant="ghost"
        disabled={busy}
        onPress={() => router.replace('/community')}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBadge name="locate" />
        <AppText variant="eyebrow">PRIVATE ACCEPTANCE TEST</AppText>
      </View>
      <AppText variant="title">Check a real background crossing.</AppText>
      <AppText>
        This uses a temporary private test area. It creates no report and never adds a pin to the
        public register.
      </AppText>
      {error && (
        <AppText accessibilityRole="alert" style={{ color: theme.error }}>
          {error}
        </AppText>
      )}
      {isAcceptanceBuild ? (
        <>
          <AppText style={{ color: theme.muted }}>
            Start at a safe place with precise GPS. Leave Civic263 Test in the background, walk
            about 300 m away, wait for the geofence exit, then return and allow a few minutes for
            the entry alert. Movement is not simulated.
          </AppText>
          <AppText variant="caption" style={{ color: theme.muted }}>
            The test expires after two hours. Its private site pin is scheduled for automatic
            cleanup; a route history is not stored. Android force-stop disables alerts until the app
            is opened again.
          </AppText>
          <ActionButton
            label={session ? 'Start a new test here' : 'Start background test here'}
            icon="locate"
            busy={busy}
            onPress={() => void run(true)}
          />
          {session && (
            <>
              <AppText variant="heading">
                {session.status === 'waiting-to-leave'
                  ? 'Waiting for you to leave the 200 m area'
                  : session.status === 'outside'
                    ? 'Exit recorded. Return to the test area.'
                    : session.status === 'returned'
                      ? 'Return recorded; checking notification delivery.'
                      : 'Return notification recorded'}
              </AppText>
              {session.events.map((event, index) => (
                <AppText key={index} variant="caption">
                  {event.kind} via {event.source} · {new Date(event.createdAt).toLocaleTimeString()}
                </AppText>
              ))}
              <ActionButton
                label="Stop test and background reminders"
                icon="close"
                variant="secondary"
                disabled={busy}
                onPress={() => void run(false)}
              />
            </>
          )}
          <ActionButton
            label="Refresh test status"
            icon="retry"
            variant="ghost"
            disabled={busy}
            onPress={() => void load()}
          />
        </>
      ) : (
        <AppText>Install the authorised Civic263 Test build to use this private test.</AppText>
      )}
    </ScrollView>
  );
}
