import { useCallback, useState } from 'react';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  canCorrectReport,
  categoryLabel,
  HANDOFF_LABELS,
  REVIEW_LABELS,
  REVIEW_REASONS,
  WITHDRAWAL_LABELS,
  workflowLabel,
  type FieldCheckKind,
  type ResidentReport,
} from '@civic263/domain';
import { withdrawMyReport } from '@/services/account-lifecycle';
import { AppText } from '@/components/app-text';
import { ActionButton, IconBadge } from '@/components/action-button';
import {
  readMyReport,
  readPublicReport,
  publicPhotoUrl,
  publicResolutionPhotoUrl,
} from '@/services/reports';
import { ReportResolution } from '@/components/report-resolution';
import { CommunityActions } from '@/components/community-actions';
import { CommunityHistory } from '@/components/community-history';
import { useTheme } from '@/theme';
import { useLayout } from '@/hooks/use-layout';
import { centeredContent } from '@/layout';
import { useAppReducedMotion } from '@/hooks/use-reduced-motion';
import { loadReportDetail, type ReportDetail } from '@/services/report-detail';

export function ReportDetailsScreen() {
  const { id, view } = useLocalSearchParams<{ id?: string; view?: 'owner' | 'public' }>();
  return <ReportDetailsView id={id} view={view} />;
}
/**
 * The report details. `embedded` renders it as a pane beside a list (tablets and foldables):
 * no back button, no extra top inset and a single column inside the pane.
 */
export function ReportDetailsView({
  id,
  view,
  embedded = false,
  onOpenPublic,
}: {
  id?: string | undefined;
  view?: 'owner' | 'public' | undefined;
  embedded?: boolean;
  onOpenPublic?: (reportId: string) => void;
}) {
  const theme = useTheme();
  const layout = useLayout();
  const twoPane = !embedded && layout.columns >= 2;
  const reduced = useAppReducedMotion();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [confirmResolution, setConfirmResolution] = useState<{
    kind: FieldCheckKind;
    fixId?: string;
  } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const busy = resolving || withdrawing;
  const withdraw = (report: ResidentReport) => {
    const published = report.publicationStatus === 'published';
    Alert.alert(
      'Withdraw this report?',
      published
        ? 'It will be removed from the public register and map, and its description, place and photos will be erased. If other residents have recorded checks on this issue, it stays public without your description or photos. This cannot be undone.'
        : 'Its description, place and photos will be erased and it will never be published. This cannot be undone.',
      [
        { text: 'Keep report', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () => {
            setWithdrawing(true);
            setManageError(null);
            withdrawMyReport(report.id)
              .then(() => setVersion((value) => value + 1))
              .catch((reason: unknown) =>
                setManageError(
                  reason instanceof Error && reason.message
                    ? reason.message
                    : 'Could not withdraw this report. Check your connection and retry.',
                ),
              )
              .finally(() => setWithdrawing(false));
          },
        },
      ],
    );
  };
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 20000);
      setError(null);
      setManageError(null);
      setImage(null);
      setConfirmResolution(null);
      setDetail((current) => (current?.item.id === id ? current : null));
      if (!id || !/^[a-f0-9]{40}$/.test(id) || (view !== 'owner' && view !== 'public')) {
        setError('Choose a report from My reports or the map.');
        clearTimeout(timeout);
        return;
      }
      const load = loadReportDetail(
        view,
        () => readMyReport(id),
        () => readPublicReport(id, abort.signal),
        abort.signal,
      );
      void load
        .then((item) => {
          if (active)
            setDetail((current) =>
              current?.kind === item.kind &&
              current.item.id === item.item.id &&
              current.item.resolution &&
              !item.item.resolution
                ? current
                : item,
            );
        })
        .catch(() => {
          if (active) setError('Could not load this report. Check your connection and retry.');
        })
        .finally(() => clearTimeout(timeout));
      return () => {
        active = false;
        abort.abort();
        clearTimeout(timeout);
      };
    }, [id, view, version]),
  );
  const photos =
    detail?.kind === 'owner'
      ? detail.item.photos.map((photo) => `data:image/jpeg;base64,${photo.base64}`)
      : detail
        ? Array.from({ length: detail.item.photoCount ?? 0 }, (_, index) =>
            publicPhotoUrl(detail.item.id, index),
          )
        : [];
  const resolutionPhotos =
    detail?.kind === 'owner'
      ? (detail.item.resolutionPhotos ?? []).map(
          (photo) => `data:image/jpeg;base64,${photo.base64}`,
        )
      : detail
        ? Array.from({ length: detail.item.resolution?.photoCount ?? 0 }, (_, index) =>
            publicResolutionPhotoUrl(detail.item.id, index),
          )
        : [];
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{
          ...centeredContent(layout, true),
          padding: embedded ? 20 : layout.gutter,
          paddingTop: embedded ? 20 : insets.top + 16,
          paddingBottom: 40,
          gap: 20,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          {embedded ? (
            <View />
          ) : (
            <ActionButton
              label="Back"
              icon="close"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/my-reports');
              }}
            />
          )}
          <ActionButton
            label="Refresh"
            icon="retry"
            variant="ghost"
            disabled={busy}
            onPress={() => setVersion((value) => value + 1)}
          />
        </View>
        {error ? (
          <AppText accessibilityRole="alert" style={{ color: theme.error }}>
            {error}
          </AppText>
        ) : !detail ? (
          <View style={{ gap: 12 }}>
            <ActivityIndicator color={theme.accent} />
            <AppText>Loading report and photos…</AppText>
          </View>
        ) : (
          <View
            style={{
              flexDirection: twoPane ? 'row' : 'column',
              alignItems: twoPane ? 'flex-start' : 'stretch',
              gap: 24,
            }}
          >
            <View style={{ flex: twoPane ? 1 : undefined, gap: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconBadge name={detail.item.categoryId} />
                <AppText variant="eyebrow" style={{ color: theme.accent }}>
                  {detail.kind === 'owner'
                    ? detail.item.testOnly
                      ? 'TEST REPORT ONLY'
                      : 'YOUR REPORT'
                    : 'PUBLIC OBSERVATION'}
                </AppText>
              </View>
              <AppText variant="title">
                {detail.kind === 'owner'
                  ? categoryLabel(detail.item.categoryId)
                  : detail.item.title}
              </AppText>
              <AppText variant="label" selectable>
                {detail.item.reference}
              </AppText>
              {detail.kind === 'owner' && detail.item.withdrawal ? (
                <AppText style={{ color: theme.muted }}>
                  The description, place and photos were erased when you withdrew this report.
                </AppText>
              ) : (
                <>
                  <AppText selectable>
                    {detail.kind === 'owner' ? detail.item.description : detail.item.summary}
                  </AppText>
                  <AppText style={{ color: theme.muted }}>
                    {detail.kind === 'owner' ? detail.item.landmark : detail.item.area}
                  </AppText>
                </>
              )}
              <View
                style={{ padding: 18, borderRadius: 18, backgroundColor: theme.surface, gap: 8 }}
              >
                <AppText variant="heading">
                  {detail.kind === 'owner' && detail.item.withdrawal
                    ? 'Withdrawn by you'
                    : ['resolved', 'resolution-pending'].includes(detail.item.workflowStatus)
                      ? workflowLabel(detail.item, detail.kind === 'owner')
                      : detail.kind === 'owner'
                        ? detail.item.testOnly
                          ? 'Test report kept private'
                          : REVIEW_LABELS[detail.item.reviewStatus]
                        : 'Published after automatic checks'}
                </AppText>
                {detail.item.resolution && (
                  <AppText style={{ color: theme.muted }}>
                    {new Date(detail.item.resolution.resolvedAt).toLocaleString()}. Recorded from
                    the reporter's observation.
                  </AppText>
                )}
                {detail.kind === 'owner' && detail.item.withdrawal && (
                  <AppText style={{ color: theme.muted }}>
                    {new Date(detail.item.withdrawal.withdrawnAt).toLocaleString()}.{' '}
                    {WITHDRAWAL_LABELS[detail.item.withdrawal.outcome]}
                  </AppText>
                )}
                {detail.kind === 'owner' &&
                  !detail.item.withdrawal &&
                  detail.item.workflowStatus !== 'resolved' &&
                  detail.item.reviewReason && (
                    <AppText style={{ color: theme.muted }}>
                      {REVIEW_REASONS[detail.item.reviewReason]}
                    </AppText>
                  )}
                <AppText variant="caption" style={{ color: theme.muted }}>
                  {workflowLabel(detail.item, detail.kind === 'owner')}.{' '}
                  {detail.kind === 'public'
                    ? HANDOFF_LABELS[detail.item.handoffStatus]
                    : 'Receipt confirms platform intake, not municipal acknowledgement.'}
                </AppText>
                {detail.kind === 'owner' && detail.item.incidentReference && (
                  <ActionButton
                    label="View public record"
                    icon="nearby"
                    variant="secondary"
                    disabled={busy}
                    onPress={() =>
                      onOpenPublic
                        ? onOpenPublic(detail.item.id)
                        : router.push({
                            pathname: '/report-details',
                            params: { id: detail.item.id, view: 'public' },
                          })
                    }
                  />
                )}
              </View>
              {detail.kind === 'owner' && !detail.item.withdrawal && (
                <View style={{ gap: 10 }}>
                  <AppText variant="heading">Manage this report</AppText>
                  <AppText variant="caption" style={{ color: theme.muted }}>
                    {canCorrectReport(detail.item)
                      ? 'You can correct the service, description, place or pin, or remove photos, until it is published. Corrections are checked again automatically.'
                      : detail.item.publicationStatus === 'published'
                        ? 'Published reports cannot be edited. Withdraw it and send a new report if something is wrong.'
                        : 'This report cannot be corrected right now. You can still withdraw it.'}
                  </AppText>
                  {canCorrectReport(detail.item) && (
                    <ActionButton
                      label="Correct details"
                      icon="edit"
                      variant="secondary"
                      disabled={busy}
                      onPress={() =>
                        router.push({
                          pathname: '/report-correction',
                          params: { id: detail.item.id },
                        })
                      }
                    />
                  )}
                  <ActionButton
                    label={withdrawing ? 'Withdrawing report' : 'Withdraw report'}
                    icon="withdraw"
                    variant="destructive"
                    busy={withdrawing}
                    disabled={resolving}
                    onPress={() => withdraw(detail.item)}
                  />
                  {manageError && (
                    <AppText accessibilityRole="alert" selectable style={{ color: theme.error }}>
                      {manageError}
                    </AppText>
                  )}
                </View>
              )}
              {detail.kind === 'public' || detail.item.publicationStatus === 'published' ? (
                <>
                  <CommunityActions
                    key={`actions-${detail.item.id}-${version}`}
                    reportId={detail.item.id}
                    version={version}
                    disabled={busy}
                    onStart={(kind, fixId) =>
                      setConfirmResolution({ kind, ...(fixId ? { fixId } : {}) })
                    }
                  />
                  <CommunityHistory
                    key={`history-${detail.item.id}-${version}`}
                    reportId={detail.item.id}
                    version={version}
                    onPhoto={setImage}
                  />
                </>
              ) : (
                detail.item.workflowStatus !== 'resolved' &&
                !detail.item.withdrawal && (
                  <AppText style={{ color: theme.muted }}>
                    Community visits are available after the issue is published. This report stays
                    private.
                  </AppText>
                )
              )}
            </View>
            <View style={{ flex: twoPane ? 1 : undefined, gap: 20 }}>
              <AppText variant="heading">
                {detail.kind === 'owner' ? 'Your submitted photos' : 'Approved public photos'}
              </AppText>
              <AppText variant="caption" style={{ color: theme.muted }}>
                {detail.kind === 'owner'
                  ? 'Only your reporting identity can view these originals. Tap a photo to enlarge it.'
                  : 'Photos passed automatic privacy checks. Public locations are approximate. Tap a photo to enlarge it.'}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {photos.map((uri, index) => (
                  <Pressable
                    key={index}
                    // Two-pane pages lead with a large first photo and a row of thumbnails.
                    style={{ width: twoPane ? (index === 0 ? '100%' : '31.5%') : '47%' }}
                    accessibilityRole="button"
                    accessibilityLabel={`Open report photo ${index + 1}`}
                    onPress={() => setImage(uri)}
                  >
                    <Image
                      source={{ uri }}
                      style={{
                        width: '100%',
                        aspectRatio: twoPane && index === 0 ? 4 / 3 : 1,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                      }}
                      contentFit="cover"
                      cachePolicy={detail.kind === 'owner' ? 'none' : 'memory-disk'}
                      accessibilityLabel={`Report photo ${index + 1}`}
                    />
                  </Pressable>
                ))}
              </View>
              {detail.item.resolution && (
                <View style={{ gap: 12 }}>
                  <AppText variant="heading">Resolution photos</AppText>
                  <AppText variant="caption" style={{ color: theme.muted }}>
                    {detail.kind === 'owner'
                      ? 'Your new camera photos are saved separately from the original report.'
                      : detail.item.resolution.evidenceStatus === 'pending'
                        ? 'Resolution photos are awaiting automatic privacy checks.'
                        : resolutionPhotos.length
                          ? 'Resolution photos cleared for public viewing. The repair is reported by the resident.'
                          : 'No resolution photos are available for public viewing.'}
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {resolutionPhotos.map((uri, index) => (
                      <Pressable
                        key={index}
                        accessibilityRole="button"
                        accessibilityLabel={`Open resolution photo ${index + 1}`}
                        style={{ width: '47%' }}
                        onPress={() => setImage(uri)}
                      >
                        <Image
                          source={{ uri }}
                          style={{ width: '100%', aspectRatio: 1, borderRadius: 14 }}
                          contentFit="cover"
                          cachePolicy={detail.kind === 'owner' ? 'none' : 'memory-disk'}
                          accessibilityLabel={`Resolution photo ${index + 1}`}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              {!photos.length && (
                <AppText style={{ color: theme.muted }}>
                  {detail.kind === 'owner'
                    ? detail.item.withdrawal
                      ? 'Photos were deleted when you withdrew this report.'
                      : 'No photos were attached to this report.'
                    : 'No public photos are available.'}
                </AppText>
              )}
            </View>
          </View>
        )}
      </ScrollView>
      {confirmResolution && detail && (
        <ReportResolution
          report={detail.item}
          kind={confirmResolution.kind}
          {...(confirmResolution.fixId ? { fixId: confirmResolution.fixId } : {})}
          onDismiss={() => setConfirmResolution(null)}
          onBusyChange={setResolving}
          onResolved={(receipt) => {
            setDetail((current) => {
              if (!current || current.item.id !== receipt.reportId) return current;
              const updates = {
                workflowStatus: receipt.workflowStatus,
                communityResolution: receipt.communityResolution,
              };
              return current.kind === 'owner'
                ? { kind: 'owner', item: { ...current.item, ...updates } }
                : { kind: 'public', item: { ...current.item, ...updates } };
            });
            setConfirmResolution(null);
            setVersion((value) => value + 1);
          }}
        />
      )}
      <Modal
        visible={image !== null}
        onRequestClose={() => setImage(null)}
        statusBarTranslucent
        navigationBarTranslucent
        animationType={reduced ? 'none' : 'fade'}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <ActionButton
            label="Close photo"
            icon="close"
            variant="ghost"
            onPress={() => setImage(null)}
          />
          {image && (
            <Image
              source={{ uri: image }}
              style={{ flex: 1 }}
              contentFit="contain"
              cachePolicy="none"
              accessibilityLabel="Enlarged report photo"
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
