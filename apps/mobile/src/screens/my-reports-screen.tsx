import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, AppState, FlatList, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  categoryLabel,
  REVIEW_LABELS,
  workflowLabel,
  type ReportDraft,
  type ResidentReport,
} from '@civic263/domain';
import { AppText } from '@/components/app-text';
import { ActionButton, IconBadge } from '@/components/action-button';
import { loadDrafts } from '@/services/drafts';
import { intakeEnabled } from '@/services/firebase';
import { listMyReports } from '@/services/reports';
import { mergeResidentReports, reportHistoryRows } from '@/services/report-history';
import { useTheme } from '@/theme';

export function MyReportsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { savedId } = useLocalSearchParams<{ savedId?: string }>();
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);
  const [reports, setReports] = useState<ResidentReport[]>([]);
  const loadedMore = useRef(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      async function loadCloud() {
        if (!intakeEnabled) return;
        try {
          const result = await listMyReports();
          if (active) {
            setReports((current) => mergeResidentReports(current, result.reports));
            if (!loadedMore.current) setNextCursor(result.nextCursor);
          }
        } catch {
          if (active) setError('Could not refresh your stored reports. Your drafts are safe.');
        }
      }
      void Promise.allSettled([
        loadDrafts()
          .then((result) => {
            if (active) {
              setDrafts(result.drafts);
              if (result.unreadableCount)
                setError('Some drafts could not be read. Their files have been preserved.');
            }
          })
          .catch(() => {
            if (active) setError('Could not read drafts. Their files have been preserved.');
          }),
        loadCloud(),
      ]).finally(() => {
        if (active) setLoading(false);
      });
      const interval = setInterval(() => {
        if (AppState.currentState === 'active') void loadCloud();
      }, 20000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [reloadKey]),
  );
  async function loadMore() {
    if (!nextCursor || moreLoading) return;
    setMoreLoading(true);
    try {
      const result = await listMyReports(nextCursor);
      setReports((current) => mergeResidentReports(current, result.reports));
      loadedMore.current = true;
      setNextCursor(result.nextCursor);
    } catch {
      setError('Could not load older reports. Please retry.');
    } finally {
      setMoreLoading(false);
    }
  }
  const rows = reportHistoryRows(drafts, reports);
  const saved = drafts.find((item) => item.id === savedId);
  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => `${row.kind}-${row.item.id}`}
      refreshing={loading}
      onRefresh={() => setReloadKey((value) => value + 1)}
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 20,
        paddingBottom: 40,
        gap: 16,
        flexGrow: 1,
      }}
      style={{ flex: 1, backgroundColor: theme.background }}
      ListHeaderComponent={
        <View style={{ gap: 18, paddingBottom: 8 }}>
          <AppText variant="eyebrow" style={{ color: theme.accent }}>
            YOUR REPORTING SPACE
          </AppText>
          <AppText variant="title">Your reports. Their progress.</AppText>
          <AppText style={{ color: theme.muted }}>
            Drafts stay on this device. Submitted reports and original photos are private to your
            reporting identity; approved public records appear separately.
          </AppText>
          <AppText variant="caption" style={{ color: theme.muted }}>
            Save your reporting identity to recover your private reports after reinstalling or
            changing phones.
          </AppText>
          <ActionButton
            label="Account and recovery"
            icon="lock"
            variant="secondary"
            onPress={() => router.push('/account')}
          />
          {saved && (
            <View style={{ padding: 16, backgroundColor: theme.tint, borderRadius: 18, gap: 8 }}>
              <AppText variant="label" accessibilityLiveRegion="polite">
                {saved.receipt
                  ? saved.receipt.testOnly
                    ? 'Test server receipt - no real report filed'
                    : 'Received by Civic263 - automatic review will follow'
                  : 'Draft saved on this device'}
              </AppText>
              <ActionButton
                label="Dismiss"
                icon="close"
                variant="ghost"
                onPress={() => router.setParams({ savedId: undefined })}
              />
            </View>
          )}
          {error && (
            <View style={{ gap: 10 }}>
              <AppText accessibilityRole="alert" style={{ color: theme.error }}>
                {error}
              </AppText>
              <ActionButton
                label="Retry loading reports"
                icon="retry"
                variant="secondary"
                onPress={() => setReloadKey((value) => value + 1)}
              />
            </View>
          )}
          <ActionButton label="New report" icon="report" onPress={() => router.push('/report')} />
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <View style={{ gap: 12, padding: 24 }}>
            <ActivityIndicator color={theme.accent} />
            <AppText>Reading drafts and reports...</AppText>
          </View>
        ) : !error ? (
          <View style={{ gap: 14, alignItems: 'center', paddingVertical: 30 }}>
            <IconBadge name="drafts" size={70} />
            <AppText variant="heading">Your first report starts here.</AppText>
            <AppText style={{ color: theme.muted, textAlign: 'center' }}>
              Report a service issue with a location and up to three photos.
            </AppText>
          </View>
        ) : (
          <></>
        )
      }
      ListFooterComponent={
        nextCursor ? (
          <ActionButton
            label="Load older reports"
            icon="retry"
            variant="secondary"
            busy={moreLoading}
            onPress={() => {
              void loadMore();
            }}
          />
        ) : (
          <></>
        )
      }
      renderItem={({ item: row }) => (
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge name={row.item.categoryId} size={40} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="label">{categoryLabel(row.item.categoryId)}</AppText>
              <AppText variant="caption" style={{ color: theme.accent }}>
                {row.kind === 'cloud'
                  ? ['resolved', 'resolution-pending'].includes(row.item.workflowStatus)
                    ? `${workflowLabel(row.item, true)}${row.item.testOnly ? ' / TEST ONLY' : ''}`
                    : row.item.testOnly
                      ? 'Test server only - no real report filed'
                      : REVIEW_LABELS[row.item.reviewStatus]
                  : row.item.receipt
                    ? row.item.receipt.testOnly
                      ? 'Test server only'
                      : 'Received by platform'
                    : row.item.submissionStartedAt
                      ? 'Delivery unconfirmed'
                      : 'Device draft'}
              </AppText>
            </View>
          </View>
          <AppText numberOfLines={4}>{row.item.description}</AppText>
          <AppText variant="caption" style={{ color: theme.muted }}>
            {row.item.landmark}
          </AppText>
          {row.kind === 'cloud' ? (
            <>
              <AppText variant="caption" style={{ color: theme.muted }}>
                {row.item.photoCount} submitted photos /{' '}
                {new Date(row.item.createdAt).toLocaleString()}
              </AppText>
              <AppText variant="label" selectable>
                {row.item.reference}
              </AppText>
              <ActionButton
                label="View report and photos"
                icon="photos"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/report-details',
                    params: { id: row.item.id, view: 'owner' },
                  })
                }
              />
            </>
          ) : (
            <>
              {!!row.item.photos?.length && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {row.item.photos.slice(0, 3).map((photo) => (
                    <Image
                      key={photo.id}
                      source={{ uri: photo.uri }}
                      style={{ width: 64, height: 64, borderRadius: 10 }}
                      accessibilityLabel="Saved report photo"
                    />
                  ))}
                </View>
              )}
              <AppText variant="caption" style={{ color: theme.muted }}>
                {row.item.photos?.length ?? 0} photos / Saved{' '}
                {new Date(row.item.updatedAt).toLocaleString()}
              </AppText>
              {row.item.receipt ? (
                <AppText variant="label" selectable>
                  {row.item.receipt.reference}
                  {row.item.receipt.testOnly ? ' / TEST ONLY' : ' / Private server receipt'}
                </AppText>
              ) : (
                <ActionButton
                  label={row.item.submissionStartedAt ? 'Check / retry delivery' : 'Continue draft'}
                  icon={row.item.submissionStartedAt ? 'retry' : 'edit'}
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/report', params: { draftId: row.item.id } })
                  }
                />
              )}
            </>
          )}
        </View>
      )}
    />
  );
}
