import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { uuid } from 'expo';
import { router } from 'expo-router';
import { File } from 'expo-file-system';
import {
  parseCommunityCheck,
  type CommunityContext,
  type FieldCheckKind,
  type CommunityCheckCommand,
  type ResolutionFix,
  type CommunityReceipt,
} from '@civic263/domain';
import { BottomSheet } from './bottom-sheet';
import { AppText } from './app-text';
import { ActionButton } from './action-button';
import { AppIcon } from './app-icon';
import { compressPhoto, removePhotoFile } from '@/services/photos';
import {
  clearResolutionDraft,
  currentResolutionFix,
  loadResolutionDraft,
  saveResolutionDraft,
  type ResolutionDraft,
  resolutionDraftKey,
} from '@/services/resolution-evidence';
import { resolveMyReport } from '@/services/reports';
import { getCommunityContext } from '@/services/community';
import { useTheme } from '@/theme';

export function ReportResolution({
  report,
  kind = 'report-fix',
  fixId,
  onDismiss,
  onResolved,
  onBusyChange,
}: {
  report: { id: string; reference: string };
  kind?: FieldCheckKind;
  fixId?: string;
  onDismiss: () => void;
  onResolved: (receipt: CommunityReceipt) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const theme = useTheme();
  const key = resolutionDraftKey(report.id, kind, fixId);
  const [context, setContext] = useState<CommunityContext | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [draft, setDraft] = useState<ResolutionDraft>({ photos: [] });
  const [fix, setFix] = useState<ResolutionFix | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);
    void Promise.all([loadResolutionDraft(key), getCommunityContext(report.id)])
      .then(([value, current]) => {
        if (active) {
          setDraft(value);
          setContext(current);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setError('Could not load saved evidence or the latest review status. Retry.');
      });
    return () => {
      active = false;
    };
  }, [report.id, key, loadKey]);
  async function run(action: () => Promise<void>) {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not finish. Your evidence is saved; retry.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  async function save(next: ResolutionDraft) {
    await saveResolutionDraft(key, next);
    setDraft(next);
  }
  const eligible =
    !!context &&
    (kind === 'report-fix'
      ? context.canReportFix
      : context.canReview && context.communityResolution?.fixId === fixId);
  async function checkSite() {
    const location = await currentResolutionFix();
    const current = await getCommunityContext(report.id, location);
    setContext(current);
    if (
      !(kind === 'report-fix'
        ? current.canReportFix
        : current.canReview && current.communityResolution?.fixId === fixId)
    )
      throw new Error(
        'This issue or your reviewer status changed. Refresh its details before continuing.',
      );
    setFix(location);
    return location;
  }
  async function capture() {
    if (draft.pending || draft.photos.length >= 3) return;
    await checkSite();
    if (!(await ImagePicker.requestCameraPermissionsAsync()).granted)
      throw new Error(
        'Allow camera access in Settings. Resolution requires new photos taken here.',
      );
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      exif: false,
      quality: 1,
    });
    if (result.canceled) return;
    const capturedAt = Date.now();
    const location = await checkSite();
    if (Math.abs(location.timestamp - capturedAt) > 30000)
      throw new Error('GPS could not confirm this capture in time. Please take the photo again.');
    setFix(location);
    const photo = await compressPhoto(result.assets[0]!);
    try {
      await save({ photos: [...draft.photos, { ...photo, capturedAt, location }] });
    } catch (reason) {
      removePhotoFile(photo);
      throw reason;
    }
  }
  async function submit() {
    let command: CommunityCheckCommand;
    if (draft.pending) command = draft.pending;
    else {
      const location = await checkSite();
      setFix(location);
      const photos = [];
      for (const photo of draft.photos)
        photos.push({
          id: photo.id,
          width: photo.width,
          height: photo.height,
          base64: await new File(photo.uri).base64(),
          captureSource: 'camera' as const,
          capturedAt: photo.capturedAt,
          location: photo.location,
        });
      command = parseCommunityCheck({
        action: kind,
        reportId: report.id,
        attemptId: uuid.v4(),
        location,
        photos,
        ...(fixId ? { fixId } : {}),
      });
      await save({ ...draft, pending: command });
    }
    let receipt: CommunityReceipt;
    try {
      receipt = await resolveMyReport(command);
    } catch (reason) {
      const code =
        typeof reason === 'object' && reason && 'code' in reason ? String(reason.code) : '';
      if (
        [
          'functions/invalid-argument',
          'functions/failed-precondition',
          'functions/not-found',
          'functions/unauthenticated',
        ].includes(code)
      )
        await save({ photos: draft.photos });
      throw reason;
    }
    try {
      clearResolutionDraft(key, draft);
    } catch {
      /* A cleanup failure must not hide the server-confirmed receipt. */
    }
    onResolved(receipt);
  }
  return (
    <BottomSheet
      isPresented
      onDismiss={() => {
        if (!lock.current) onDismiss();
      }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 48 }}>
        <AppText variant="eyebrow" style={{ color: theme.accent }}>
          ON-SITE UPDATE
        </AppText>
        <AppText variant="heading">
          {kind === 'report-fix'
            ? 'Show what has been fixed'
            : kind === 'confirm-fix'
              ? 'Confirm the repair on site'
              : 'Show what is still broken'}
        </AppText>
        <AppText>
          {kind === 'report-fix'
            ? 'Visit the actual defect site and take 1–3 new photos. Your fix stays on the map until another resident confirms it.'
            : 'Check the actual site and take 1–3 new photos of its condition. This independent visit will be recorded in the issue history.'}
        </AppText>
        {context && !eligible && (
          <AppText style={{ color: theme.muted }}>
            {context.ownProposal
              ? 'A different resident must confirm your fix.'
              : kind !== 'report-fix' && !context.reviewer
                ? 'Opt into community reviewing to confirm or reject a fix.'
                : 'This issue has changed. Refresh its details before starting another visit.'}
          </AppText>
        )}
        {kind !== 'report-fix' && context && !context.reviewer && (
          <ActionButton
            label="Join community reviewers"
            icon="check"
            onPress={() => {
              onDismiss();
              router.push('/community');
            }}
          />
        )}
        {fix && (
          <AppText accessibilityLiveRegion="polite" style={{ color: theme.accent }}>
            At the defect site · GPS accuracy within {Math.round(fix.accuracyMeters)} m
          </AppText>
        )}
        <ActionButton
          label="Check my location"
          icon="locate"
          variant="secondary"
          busy={busy}
          disabled={!ready || !!draft.pending || !eligible}
          onPress={() =>
            void run(async () => {
              await checkSite();
            })
          }
        />
        <AppText variant="label">{draft.photos.length} / 3 photos · at least 1 required</AppText>
        <AppText variant="caption" style={{ color: theme.muted }}>
          New camera photos only. Avoid faces, plates and private interiors. Photos are compressed
          and kept private until automatic privacy checks allow public copies.
        </AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {draft.photos.map((photo, index) => (
            <View key={photo.id} style={{ width: '30%', gap: 6 }}>
              <Image
                source={{ uri: photo.uri }}
                style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
                accessibilityLabel={`Resolution photo ${index + 1}`}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove resolution photo ${index + 1}`}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.surface,
                  borderRadius: 22,
                }}
                disabled={busy || !!draft.pending}
                onPress={() =>
                  void run(async () => {
                    await save({ photos: draft.photos.filter((item) => item.id !== photo.id) });
                    removePhotoFile(photo);
                  })
                }
              >
                <AppIcon name="close" size={18} />
              </Pressable>
            </View>
          ))}
        </View>
        <ActionButton
          label="Take site photo"
          icon="camera"
          variant="secondary"
          disabled={!ready || busy || !!draft.pending || draft.photos.length >= 3 || !eligible}
          onPress={() => void run(capture)}
        />
        {draft.pending && (
          <AppText style={{ color: theme.muted }}>
            Delivery was not confirmed. Retry the saved evidence to check its receipt.
          </AppText>
        )}
        {error && !ready && (
          <ActionButton
            label="Retry loading"
            icon="retry"
            variant="secondary"
            onPress={() => setLoadKey((value) => value + 1)}
          />
        )}
        {error && (
          <AppText accessibilityRole="alert" style={{ color: theme.error }}>
            {error}
          </AppText>
        )}
        <ActionButton
          label={
            draft.pending
              ? 'Retry saved visit'
              : kind === 'report-fix'
                ? 'Report this fix'
                : kind === 'confirm-fix'
                  ? 'Confirm fixed'
                  : 'Confirm still broken'
          }
          icon="check"
          busy={busy}
          disabled={!ready || draft.photos.length < 1 || (!draft.pending && !eligible)}
          onPress={() => void run(submit)}
        />
        <ActionButton
          label="Close for now"
          icon="close"
          variant="ghost"
          disabled={busy}
          onPress={onDismiss}
        />
      </ScrollView>
    </BottomSheet>
  );
}
