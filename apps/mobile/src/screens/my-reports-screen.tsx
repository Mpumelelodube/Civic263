import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, AppState, FlatList, StyleSheet, View } from 'react-native';
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
import { DraftPreview } from '@/components/draft-preview';
import { EmptyPane, ListRow, PaneHeader, Segmented, SummaryStrip } from '@/components/pane';
import { ReportDetailsView } from '@/screens/report-details-screen';
import { loadDrafts } from '@/services/drafts';
import { intakeEnabled } from '@/services/firebase';
import { listMyReports } from '@/services/reports';
import {
  countReportGroups,
  mergeResidentReports,
  reportGroup,
  reportHistoryRows,
  type ReportGroup,
  type ReportHistoryRow,
} from '@/services/report-history';
import { spacing, useTheme } from '@/theme';
import { useLayout } from '@/hooks/use-layout';
import { centeredContent } from '@/layout';

const rowKey = (row: ReportHistoryRow) => `${row.kind}-${row.item.id}`;
function statusLabel(row: ReportHistoryRow) {
  if (row.kind === 'cloud')
    return row.item.withdrawal
      ? 'Withdrawn by you'
      : ['resolved', 'resolution-pending'].includes(row.item.workflowStatus)
        ? `${workflowLabel(row.item, true)}${row.item.testOnly ? ' / TEST ONLY' : ''}`
        : row.item.testOnly
          ? 'Test server only - no real report filed'
          : REVIEW_LABELS[row.item.reviewStatus];
  return row.item.receipt
    ? row.item.receipt.testOnly
      ? 'Test server only'
      : 'Received by platform'
    : row.item.submissionStartedAt
      ? 'Delivery unconfirmed'
      : 'Device draft';
}
const rowDate = (row: ReportHistoryRow) =>
  new Date(row.kind === 'cloud' ? row.item.createdAt : row.item.updatedAt).toLocaleDateString();

export function MyReportsScreen() {
  const theme = useTheme();
  const layout = useLayout();
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
  const [group, setGroup] = useState<ReportGroup | 'all'>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [publicView, setPublicView] = useState(false);
  useEffect(() => {
    if (savedId) setSelectedKey(`draft-${savedId}`);
  }, [savedId]);
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
  const savedBanner = saved && (
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
  );
  const errorBlock = error && (
    <View style={{ gap: 10 }}>
      <AppText accessibilityRole="alert" selectable style={{ color: theme.error }}>
        {error}
      </AppText>
      <ActionButton
        label="Retry loading reports"
        icon="retry"
        variant="secondary"
        onPress={() => setReloadKey((value) => value + 1)}
      />
    </View>
  );
  const loadOlder = nextCursor ? (
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
  );

  if (layout.listDetail) {
    // Tablets and foldables: filtered list on the left, the selected report or draft beside it.
    const counts = countReportGroups(rows);
    const filtered = group === 'all' ? rows : rows.filter((row) => reportGroup(row) === group);
    const selectedRow =
      filtered.find((row) => rowKey(row) === selectedKey) ?? (loading ? undefined : filtered[0]);
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.background }}>
        <View
          style={{
            width: layout.listPaneWidth,
            backgroundColor: theme.navigation,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderRightColor: theme.border,
          }}
        >
          <FlatList
            data={filtered}
            keyExtractor={rowKey}
            refreshing={loading}
            onRefresh={() => setReloadKey((value) => value + 1)}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{
              padding: spacing.lg,
              paddingTop: insets.top + spacing.xxl,
              paddingBottom: insets.bottom + 40,
              gap: 2,
            }}
            ListHeaderComponent={
              <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
                <PaneHeader eyebrow="YOUR REPORTING SPACE" title="My reports" />
                <SummaryStrip
                  items={[
                    { label: 'Drafts', value: counts.drafts },
                    { label: 'Submitted', value: counts.submitted },
                    { label: 'Resolved', value: counts.resolved },
                  ]}
                />
                <Segmented
                  accessibilityLabel="Filter reports"
                  value={group}
                  onChange={setGroup}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'drafts', label: 'Drafts' },
                    { value: 'submitted', label: 'Sent' },
                    { value: 'resolved', label: 'Resolved' },
                  ]}
                />
                <ActionButton
                  label="New report"
                  icon="report"
                  onPress={() => router.push('/report')}
                />
                {savedBanner}
                {errorBlock}
              </View>
            }
            ListEmptyComponent={
              loading ? (
                <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md }}>
                  <ActivityIndicator color={theme.accent} />
                  <AppText style={{ color: theme.muted }}>Reading drafts and reports…</AppText>
                </View>
              ) : (
                <AppText style={{ color: theme.muted, padding: spacing.md }}>
                  {rows.length ? 'No reports match this filter.' : 'No reports or drafts yet.'}
                </AppText>
              )
            }
            ListFooterComponent={<View style={{ paddingTop: spacing.md }}>{loadOlder}</View>}
            renderItem={({ item: row }) => (
              <ListRow
                icon={row.item.categoryId}
                title={row.item.description || categoryLabel(row.item.categoryId)}
                status={statusLabel(row)}
                meta={`${categoryLabel(row.item.categoryId)} · ${rowDate(row)}`}
                selected={!!selectedRow && rowKey(row) === rowKey(selectedRow)}
                onPress={() => {
                  setSelectedKey(rowKey(row));
                  setPublicView(false);
                }}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          {selectedRow ? (
            selectedRow.kind === 'cloud' ? (
              <ReportDetailsView
                key={`${selectedRow.item.id}-${publicView ? 'public' : 'owner'}`}
                id={selectedRow.item.id}
                view={publicView ? 'public' : 'owner'}
                embedded
                onOpenPublic={() => setPublicView(true)}
              />
            ) : (
              <DraftPreview key={selectedRow.item.id} draft={selectedRow.item} />
            )
          ) : loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : (
            <EmptyPane
              icon="drafts"
              title={rows.length ? 'Choose a report' : 'Your first report starts here'}
              body={
                rows.length
                  ? 'Select a report or draft on the left to see its progress, place and photos.'
                  : 'Report a service issue with a location and up to three photos. Drafts stay on this device until you send them.'
              }
            >
              {!rows.length && (
                <ActionButton
                  label="Report an issue"
                  icon="report"
                  onPress={() => router.push('/report')}
                />
              )}
            </EmptyPane>
          )}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={rowKey}
      refreshing={loading}
      onRefresh={() => setReloadKey((value) => value + 1)}
      contentContainerStyle={{
        ...centeredContent(layout, true),
        padding: layout.gutter,
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
          {savedBanner}
          {errorBlock}
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
      ListFooterComponent={loadOlder}
      renderItem={({ item: row }) => (
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBadge name={row.item.categoryId} size={40} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="label">{categoryLabel(row.item.categoryId)}</AppText>
              <AppText variant="caption" style={{ color: theme.accent }}>
                {statusLabel(row)}
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
