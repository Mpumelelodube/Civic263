import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  categoryLabel,
  DEFAULT_COMMUNITY_PREFERENCES,
  FIELD_CHECK_LABELS,
  isOpenIncident,
  workflowLabel,
  type CommunityPreferences,
  type CommunityVisit,
  type PublicIncident,
  type IssueLocation,
  type ResidentNotification,
} from '@civic263/domain';
import { AppText } from '@/components/app-text';
import { ActionButton, IconBadge } from '@/components/action-button';
import { BottomSheet } from '@/components/bottom-sheet';
import {
  getCommunityInbox,
  getCommunityProfile,
  getMyVisits,
  readCommunityNotification,
  saveCommunityPreferences,
} from '@/services/community';
import { readNearbyReports, invalidateNearbyReports } from '@/services/reports';
import { useTheme } from '@/theme';
import { isAcceptanceBuild } from '@/services/field-test';
import { applyCommunityPreferences, prepareCommunityPreferences } from '@/services/nearby-alerts';

export function CommunityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [testIdentity, setTestIdentity] = useState(false);
  const [tab, setTab] = useState<'nearby' | 'inbox' | 'visits'>('nearby');
  const [preferences, setPreferences] = useState<CommunityPreferences | null>(null);
  const [inbox, setInbox] = useState<ResidentNotification[]>([]);
  const [visits, setVisits] = useState<CommunityVisit[]>([]);
  const [inboxCursor, setInboxCursor] = useState<string | null>(null);
  const [visitCursor, setVisitCursor] = useState<string | null>(null);
  const [issues, setIssues] = useState<PublicIncident[]>([]);
  const lastCentre = useRef<IssueLocation | null>(null);
  const [searched, setSearched] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const values = await Promise.allSettled([
      getCommunityProfile(),
      getCommunityInbox(),
      getMyVisits(),
    ]);
    if (values[0].status === 'fulfilled') {
      setPreferences(values[0].value.preferences);
      setTestIdentity(values[0].value.testIdentity);
    }
    if (values[1].status === 'fulfilled') {
      setInbox(values[1].value.items);
      setInboxCursor(values[1].value.nextCursor);
    }
    if (values[2].status === 'fulfilled') {
      setVisits(values[2].value.items);
      setVisitCursor(values[2].value.nextCursor);
    }
    if (values.some((value) => value.status === 'rejected'))
      setError('Could not refresh all community updates. Your loaded items are still shown.');
    if (lastCentre.current) {
      try {
        invalidateNearbyReports();
        const result = await readNearbyReports(lastCentre.current, AbortSignal.timeout(30000));
        setIssues(result.incidents.filter(isOpenIncident));
        setTruncated(result.truncated);
      } catch {
        setError('Could not refresh nearby checks. Try again.');
      }
    }
    setLoading(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
      const resume = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });
      const notification = Notifications.addNotificationReceivedListener(() => {
        void load();
      });
      return () => {
        resume.remove();
        notification.remove();
      };
    }, [load]),
  );
  async function nearby() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted)
        throw new Error('Allow location to find nearby checks, or open an issue from the map.');
      const point = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Location is taking too long. Try outdoors and retry.')),
            20000,
          ),
        ),
      ]);
      lastCentre.current = { latitude: point.coords.latitude, longitude: point.coords.longitude };
      invalidateNearbyReports();
      const result = await readNearbyReports(lastCentre.current, AbortSignal.timeout(30000));
      setIssues(result.incidents.filter(isOpenIncident));
      setTruncated(result.truncated);
      setSearched(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load nearby checks.');
    } finally {
      setBusy(false);
    }
  }
  async function changePreferences(next: CommunityPreferences) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const prepared = await prepareCommunityPreferences(
        next,
        preferences ?? DEFAULT_COMMUNITY_PREFERENCES,
      );
      const result = await saveCommunityPreferences(prepared.preferences);
      setPreferences(result.preferences);
      await applyCommunityPreferences(result.preferences);
      setNotice(prepared.notice);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your preferences.');
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (tab === 'inbox' && inboxCursor) {
        const result = await getCommunityInbox(inboxCursor);
        setInbox((current) => [
          ...new Map([...current, ...result.items].map((item) => [item.id, item])).values(),
        ]);
        setInboxCursor(result.nextCursor);
      }
      if (tab === 'visits' && visitCursor) {
        const result = await getMyVisits(visitCursor);
        setVisits((current) => [
          ...new Map([...current, ...result.items].map((item) => [item.id, item])).values(),
        ]);
        setVisitCursor(result.nextCursor);
      }
    } catch {
      setError('Could not load more updates. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function openNotification(item: ResidentNotification) {
    try {
      await readCommunityNotification(item.id);
      setInbox((current) =>
        current.map((value) =>
          value.id === item.id ? { ...value, readAt: new Date().toISOString() } : value,
        ),
      );
    } catch {
      setError('Could not mark this update read.');
    }
    router.push({ pathname: '/report-details', params: { id: item.reportId, view: 'public' } });
  }
  const pending = issues.filter(
    (item) => item.communityResolution?.status === 'awaiting-confirmation',
  );
  const options = preferences ?? DEFAULT_COMMUNITY_PREFERENCES;
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 16,
          paddingBottom: 40,
          gap: 20,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <AppText variant="eyebrow" style={{ color: theme.accent }}>
            COMMUNITY
          </AppText>
          <ActionButton
            label="Preferences"
            icon="settings"
            variant="ghost"
            disabled={!preferences || busy || loading}
            onPress={() => setSettings(true)}
          />
        </View>
        <AppText variant="title">Review nearby fixes</AppText>
        <AppText style={{ color: theme.muted }}>
          Help check fixes near you. A reported fix stays on the map until a different resident
          confirms it on site.
        </AppText>
        {isAcceptanceBuild && (
          <>
            <AppText variant="eyebrow">CIVIC263 TEST BUILD</AppText>
            {testIdentity ? (
              <ActionButton
                label="Private background field test"
                icon="locate"
                variant="secondary"
                onPress={() => router.push('/field-test')}
              />
            ) : (
              <ActionButton
                label="Show test account reference"
                icon="lock"
                variant="secondary"
                onPress={() => router.push('/account')}
              />
            )}
          </>
        )}
        {preferences && (
          <View style={{ padding: 18, gap: 12, borderRadius: 18, backgroundColor: theme.surface }}>
            <AppText variant="label">
              {preferences.reviewer
                ? 'You are a community reviewer'
                : 'Volunteer to review local fixes'}
            </AppText>
            <AppText variant="caption" style={{ color: theme.muted }}>
              Review when you can. Each visit needs a current on-site location and new camera
              photos.
            </AppText>
            <ActionButton
              label={preferences.reviewer ? 'Pause reviewing' : 'Join community reviewers'}
              icon="check"
              variant="secondary"
              disabled={busy || loading}
              onPress={() =>
                void changePreferences({ ...preferences, reviewer: !preferences.reviewer })
              }
            />
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {(['nearby', 'inbox', 'visits'] as const).map((value) => (
            <ActionButton
              key={value}
              label={value === 'nearby' ? 'Nearby' : value === 'inbox' ? 'Inbox' : 'Your visits'}
              icon={value === 'nearby' ? 'nearby' : value === 'inbox' ? 'bell' : 'drafts'}
              variant={tab === value ? 'secondary' : 'ghost'}
              style={{ flex: 1 }}
              onPress={() => setTab(value)}
            />
          ))}
        </View>
        {loading && <ActivityIndicator color={theme.accent} />}
        {error && (
          <AppText accessibilityRole="alert" style={{ color: theme.error }}>
            {error}
          </AppText>
        )}
        {notice && <AppText style={{ color: theme.muted }}>{notice}</AppText>}
        <ActionButton
          label="Refresh updates"
          icon="retry"
          variant="ghost"
          disabled={loading || busy}
          onPress={() => void load()}
        />
        {tab === 'nearby' && (
          <>
            <ActionButton
              label={searched ? 'Refresh nearby checks' : 'Find checks near me'}
              icon="locate"
              busy={busy}
              onPress={() => void nearby()}
            />
            <AppText variant="heading">
              {searched
                ? `${pending.length} ${pending.length === 1 ? 'fix' : 'fixes'} awaiting confirmation`
                : 'Check what has changed nearby'}
            </AppText>
            {!searched && (
              <AppText style={{ color: theme.muted }}>
                Use your current location to find published issues within 5 km. You can also open
                any issue from Nearby.
              </AppText>
            )}
            {searched && !issues.length && (
              <AppText style={{ color: theme.muted }}>
                No active published issues were found in this area. Try another area on the map.
              </AppText>
            )}
            {truncated && (
              <AppText style={{ color: theme.muted }}>
                This area has more reports than can be loaded at once. Move the map closer to
                explore.
              </AppText>
            )}
            {[
              ...pending,
              ...issues.filter(
                (item) => item.communityResolution?.status !== 'awaiting-confirmation',
              ),
            ].map((item) => (
              <View
                key={item.id}
                style={{
                  gap: 12,
                  paddingVertical: 16,
                  borderTopWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <IconBadge name={item.categoryId} />
                  <View style={{ flex: 1, gap: 5 }}>
                    <AppText variant="label">{item.title}</AppText>
                    <AppText variant="caption" style={{ color: theme.muted }}>
                      {categoryLabel(item.categoryId)} · {item.area}
                    </AppText>
                  </View>
                </View>
                <AppText style={{ color: theme.accent }}>{workflowLabel(item)}</AppText>
                <ActionButton
                  label={
                    item.communityResolution?.status === 'awaiting-confirmation'
                      ? 'Review this fix'
                      : 'View issue and report a fix'
                  }
                  icon="arrow"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/report-details',
                      params: { id: item.id, view: 'public' },
                    })
                  }
                />
              </View>
            ))}
          </>
        )}
        {tab === 'inbox' && (
          <>
            {!loading && !inbox.length && (
              <AppText style={{ color: theme.muted }}>
                No updates yet. Fix reports and community reviews of your issues will appear here.
              </AppText>
            )}
            {inbox.map((item) => (
              <View
                key={item.id}
                style={{
                  gap: 10,
                  paddingVertical: 16,
                  borderTopWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <AppText variant="label">
                  {FIELD_CHECK_LABELS[item.kind]}
                  {item.readAt ? '' : ' · New'}
                </AppText>
                <AppText>{item.reference}</AppText>
                <AppText variant="caption" style={{ color: theme.muted }}>
                  {new Date(item.createdAt).toLocaleString()}
                </AppText>
                <ActionButton
                  label="Open issue update"
                  icon="arrow"
                  variant="secondary"
                  onPress={() => void openNotification(item)}
                />
              </View>
            ))}
            {inboxCursor && (
              <ActionButton
                label="More updates"
                icon="arrow"
                variant="ghost"
                busy={busy}
                onPress={() => void more()}
              />
            )}
          </>
        )}
        {tab === 'visits' && (
          <>
            {!loading && !visits.length && (
              <AppText style={{ color: theme.muted }}>
                Your site visits will appear here after you report or review a fix.
              </AppText>
            )}
            {visits.map((item) => (
              <View
                key={item.id}
                style={{
                  gap: 10,
                  paddingVertical: 16,
                  borderTopWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <AppText variant="label">{FIELD_CHECK_LABELS[item.kind]}</AppText>
                <AppText>{item.reference}</AppText>
                <AppText variant="caption" style={{ color: theme.muted }}>
                  {item.ownPhotoCount} private visit photos ·{' '}
                  {new Date(item.createdAt).toLocaleString()}
                </AppText>
                <ActionButton
                  label="View your visit photos"
                  icon="photos"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/community-visit', params: { id: item.id } })
                  }
                />
              </View>
            ))}
            {visitCursor && (
              <ActionButton
                label="More visits"
                icon="arrow"
                variant="ghost"
                busy={busy}
                onPress={() => void more()}
              />
            )}
          </>
        )}
      </ScrollView>
      <BottomSheet
        isPresented={settings}
        onDismiss={() => {
          if (!busy) setSettings(false);
        }}
      >
        <ScrollView contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 48 }}>
          <AppText variant="heading">Your community preferences</AppText>
          <AppText style={{ color: theme.muted }}>
            Choose how you want to help. Nearby prompts are invitations; you can dismiss them or
            pause at any time.
          </AppText>
          {(
            [
              [
                'reviewer',
                'Volunteer reviewing',
                'Confirm or reject fixes after a new on-site visit.',
              ],
              [
                'nearbyAlerts',
                'Nearby reminders',
                'Get a prompt near published defects and fixes awaiting review.',
              ],
              [
                'backgroundAlerts',
                'Remind me in the background',
                'Allow location-based prompts when Civic263 is not open.',
              ],
              ['pushUpdates', 'Push updates', 'Receive fix and review updates for your reports.'],
            ] as const
          ).map(([key, label, description]) => (
            <View
              key={key}
              style={{ gap: 8, paddingVertical: 10, borderTopWidth: 1, borderColor: theme.border }}
            >
              <AppText variant="label">
                {label}: {options[key] ? 'On' : 'Off'}
              </AppText>
              <AppText variant="caption" style={{ color: theme.muted }}>
                {description}
              </AppText>
              <ActionButton
                label={
                  options[key] ? `Pause ${label.toLowerCase()}` : `Enable ${label.toLowerCase()}`
                }
                icon={key === 'pushUpdates' ? 'bell' : key === 'reviewer' ? 'check' : 'locate'}
                variant="secondary"
                disabled={busy || loading || !preferences}
                onPress={() =>
                  void changePreferences({
                    ...options,
                    [key]: !options[key],
                    ...(key === 'nearbyAlerts' && options.nearbyAlerts
                      ? { backgroundAlerts: false }
                      : {}),
                    ...(key === 'backgroundAlerts' && !options.backgroundAlerts
                      ? { nearbyAlerts: true }
                      : {}),
                  })
                }
              />
            </View>
          ))}
          {notice && <AppText style={{ color: theme.muted }}>{notice}</AppText>}
          {error && (
            <AppText accessibilityRole="alert" style={{ color: theme.error }}>
              {error}
            </AppText>
          )}
          <ActionButton
            label="Done"
            icon="check"
            variant="ghost"
            disabled={busy}
            onPress={() => setSettings(false)}
          />
        </ScrollView>
      </BottomSheet>
    </View>
  );
}
