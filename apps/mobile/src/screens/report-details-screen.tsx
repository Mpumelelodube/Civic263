import { useCallback, useState } from 'react';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  categoryLabel,
  HANDOFF_LABELS,
  REVIEW_LABELS,
  REVIEW_REASONS,
  workflowLabel,
  type FieldCheckKind,
  type PublicIncident,
  type ResidentReportDetail,
} from '@civic263/domain';
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
import { useAppReducedMotion } from '@/hooks/use-reduced-motion';

type Detail =
  { kind: 'owner'; item: ResidentReportDetail } | { kind: 'public'; item: PublicIncident };
export function ReportDetailsScreen() {
  const { id, view } = useLocalSearchParams<{ id?: string; view?: 'owner' | 'public' }>();
  const theme = useTheme();
  const reduced = useAppReducedMotion();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [confirmResolution, setConfirmResolution] = useState<{
    kind: FieldCheckKind;
    fixId?: string;
  } | null>(null);
  const [resolving, setResolving] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 20000);
      setError(null);
      setImage(null);
      setConfirmResolution(null);
      setDetail((current) => (current?.item.id === id ? current : null));
      if (!id || !/^[a-f0-9]{40}$/.test(id) || (view !== 'owner' && view !== 'public')) {
        setError('Choose a report from My reports or the map.');
        clearTimeout(timeout);
        return;
      }
      const load: Promise<Detail> =
        view === 'owner'
          ? readMyReport(id).then((item) => ({ kind: 'owner', item }))
          : readPublicReport(id, abort.signal).then((item) => ({ kind: 'public', item }));
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
          padding: 20,
          paddingTop: insets.top + 16,
          paddingBottom: 40,
          gap: 20,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <ActionButton
            label="Back"
            icon="close"
            variant="ghost"
            disabled={resolving}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/my-reports');
            }}
          />
          <ActionButton
            label="Refresh"
            icon="retry"
            variant="ghost"
            disabled={resolving}
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
          <>
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
              {detail.kind === 'owner' ? categoryLabel(detail.item.categoryId) : detail.item.title}
            </AppText>
            <AppText variant="label" selectable>
              {detail.item.reference}
            </AppText>
            <AppText selectable>
              {detail.kind === 'owner' ? detail.item.description : detail.item.summary}
            </AppText>
            <AppText style={{ color: theme.muted }}>
              {detail.kind === 'owner' ? detail.item.landmark : detail.item.area}
            </AppText>
            <View style={{ padding: 18, borderRadius: 18, backgroundColor: theme.surface, gap: 8 }}>
              <AppText variant="heading">
                {['resolved', 'resolution-pending'].includes(detail.item.workflowStatus)
                  ? workflowLabel(detail.item, detail.kind === 'owner')
                  : detail.kind === 'owner'
                    ? detail.item.testOnly
                      ? 'Test report kept private'
                      : REVIEW_LABELS[detail.item.reviewStatus]
                    : 'Published after automatic checks'}
              </AppText>
              {detail.item.resolution && (
                <AppText style={{ color: theme.muted }}>
                  {new Date(detail.item.resolution.resolvedAt).toLocaleString()}. Recorded from the
                  reporter's observation.
                </AppText>
              )}
              {detail.kind === 'owner' &&
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
                  disabled={resolving}
                  onPress={() =>
                    router.push({
                      pathname: '/report-details',
                      params: { id: detail.item.id, view: 'public' },
                    })
                  }
                />
              )}
            </View>
            {detail.kind === 'public' || detail.item.publicationStatus === 'published' ? (
              <>
                <CommunityActions
                  key={`actions-${detail.item.id}-${version}`}
                  reportId={detail.item.id}
                  version={version}
                  disabled={resolving}
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
              detail.item.workflowStatus !== 'resolved' && (
                <AppText style={{ color: theme.muted }}>
                  Community visits are available after the issue is published. This report stays
                  private.
                </AppText>
              )
            )}
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
                  style={{ width: '47%' }}
                  accessibilityRole="button"
                  accessibilityLabel={`Open report photo ${index + 1}`}
                  onPress={() => setImage(uri)}
                >
                  <Image
                    source={{ uri }}
                    style={{ width: '100%', aspectRatio: 1, borderRadius: 14 }}
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
                  ? 'No photos were attached to this report.'
                  : 'No public photos are available.'}
              </AppText>
            )}
          </>
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
