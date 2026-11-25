import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import {
  MAX_REPORT_CORRECTIONS,
  canCorrectReport,
  validateDraft,
  type CategoryId,
  type ReportLocation,
  type ResidentReportDetail,
} from '@civic263/domain';
import { AppText } from '@/components/app-text';
import { AppIcon } from '@/components/app-icon';
import { ActionButton } from '@/components/action-button';
import { FormField } from '@/components/form-field';
import { CategoryGrid } from '@/components/category-grid';
import { ReportLocationField } from '@/components/report-location';
import { readMyReport } from '@/services/reports';
import { correctMyReport } from '@/services/account-lifecycle';
import { centeredContent } from '@/layout';
import { useLayout } from '@/hooks/use-layout';
import { radius, spacing, useTheme } from '@/theme';

/** Correct an unpublished report. The corrected version replaces the earlier one completely. */
export function ReportCorrectionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const layout = useLayout();
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<ResidentReportDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<CategoryId>('roads');
  const [description, setDescription] = useState('');
  const [landmark, setLandmark] = useState('');
  const [location, setLocation] = useState<ReportLocation | undefined>(undefined);
  const [removed, setRemoved] = useState<number[]>([]);
  const [preparingLocation, setPreparingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!id || !/^[a-f0-9]{40}$/.test(id)) {
      setLoadError('Choose a report from My reports.');
      return;
    }
    readMyReport(id)
      .then((item) => {
        if (!active) return;
        if (!canCorrectReport(item)) {
          setLoadError(
            item.publicationStatus === 'published'
              ? 'This report is already published, so it cannot be edited. Withdraw it and send a new report instead.'
              : 'This report cannot be corrected right now. Return to it and check its status.',
          );
          return;
        }
        setReport(item);
        setCategoryId(item.categoryId);
        setDescription(item.description);
        setLandmark(item.landmark);
        setLocation(item.location ?? undefined);
      })
      .catch(() => {
        if (active) setLoadError('Could not load this report. Check your connection and retry.');
      });
    return () => {
      active = false;
    };
  }, [id]);
  const formWidth = Math.min(680, layout.contentWidth - layout.gutter * 2);
  const columns = formWidth >= 600 ? 4 : formWidth >= 380 ? 3 : 2;
  const problems = [
    ...validateDraft({ categoryId, description, landmark }),
    ...(location ? [] : ['Confirm the report pin.']),
  ];
  const disabled = saving || !report;
  const remaining = report ? MAX_REPORT_CORRECTIONS - report.correctionCount - 1 : 0;
  async function save() {
    if (!report || problems.length) {
      setError(problems.join(' ') || null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await correctMyReport({
        reportId: report.id,
        revision: report.revision,
        categoryId,
        description: description.trim(),
        landmark: landmark.trim(),
        location: location!,
        keepPhotos: report.photos.map((_, index) => index).filter((i) => !removed.includes(i)),
      });
      if (router.canGoBack()) router.back();
      else router.replace('/my-reports');
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'Could not save the correction. Check your connection and retry.',
      );
      setSaving(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAwareScrollView
        bottomOffset={spacing.xxl}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          ...centeredContent(layout),
          padding: layout.gutter,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + 48,
          gap: spacing.section,
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <ActionButton
            label="Cancel"
            icon="close"
            variant="ghost"
            disabled={saving}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/my-reports'))}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="eyebrow" style={{ color: theme.accent }}>
            CORRECT YOUR REPORT
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            Fix the details before it is published.
          </AppText>
          {report && (
            <AppText variant="label" selectable>
              {report.reference}
            </AppText>
          )}
          <AppText style={{ color: theme.muted }}>
            Your corrected version replaces the earlier one completely; the earlier text is not
            kept. Automatic checks run again before anything is published.
          </AppText>
        </View>
        {loadError ? (
          <AppText accessibilityRole="alert" selectable style={{ color: theme.error }}>
            {loadError}
          </AppText>
        ) : !report ? (
          <View style={{ gap: spacing.md }}>
            <ActivityIndicator color={theme.accent} />
            <AppText>Loading your report…</AppText>
          </View>
        ) : (
          <>
            <View style={{ gap: spacing.md }}>
              <AppText variant="eyebrow" style={{ color: theme.muted }}>
                01 / SERVICE
              </AppText>
              <CategoryGrid
                value={categoryId}
                onChange={setCategoryId}
                columns={columns}
                disabled={disabled}
              />
            </View>
            <View style={{ gap: spacing.lg }}>
              <AppText variant="eyebrow" style={{ color: theme.muted }}>
                02 / WHAT YOU SAW
              </AppText>
              <FormField
                label="What needs attention?"
                icon="edit"
                hint="At least 10 characters. Leave out names and contact details."
                minimum={10}
                maxLength={1000}
                multiline
                value={description}
                onChangeText={(text) => {
                  setDescription(text);
                  setError(null);
                }}
                editable={!disabled}
              />
            </View>
            <View style={{ gap: spacing.lg }}>
              <AppText variant="eyebrow" style={{ color: theme.muted }}>
                03 / PLACE AND PIN
              </AppText>
              <ReportLocationField
                value={landmark}
                location={location}
                categoryId={categoryId}
                onChangeText={(text) => {
                  setLandmark(text);
                  setError(null);
                }}
                onLocationChange={setLocation}
                onBusyChange={setPreparingLocation}
                disabled={disabled}
              />
            </View>
            {report.photos.length > 0 && (
              <View style={{ gap: spacing.md }}>
                <AppText variant="eyebrow" style={{ color: theme.muted }}>
                  04 / PHOTOS
                </AppText>
                <AppText variant="caption" style={{ color: theme.muted }}>
                  Tap a photo to remove it. Removed photos are deleted. To add photos, withdraw this
                  report and send a new one.
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {report.photos.map((photo, index) => {
                    const kept = !removed.includes(index);
                    return (
                      <Pressable
                        key={index}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: kept, disabled }}
                        accessibilityLabel={`Photo ${index + 1}: ${kept ? 'kept' : 'will be removed'}`}
                        disabled={disabled}
                        onPress={() =>
                          setRemoved((current) =>
                            kept ? [...current, index] : current.filter((item) => item !== index),
                          )
                        }
                        style={{ width: '31.5%' }}
                      >
                        <Image
                          source={{ uri: `data:image/jpeg;base64,${photo.base64}` }}
                          cachePolicy="none"
                          contentFit="cover"
                          style={{
                            width: '100%',
                            aspectRatio: 1,
                            borderRadius: radius.md,
                            borderCurve: 'continuous',
                            opacity: kept ? 1 : 0.35,
                          }}
                        />
                        <View
                          style={{
                            position: 'absolute',
                            top: spacing.xs,
                            right: spacing.xs,
                            borderRadius: radius.full,
                            backgroundColor: theme.surface,
                            padding: 2,
                          }}
                        >
                          <AppIcon
                            name={kept ? 'check' : 'close'}
                            size={20}
                            color={kept ? theme.accent : theme.error}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {error && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.sm,
                  padding: spacing.lg,
                  backgroundColor: theme.surface,
                  borderRadius: radius.lg,
                  borderCurve: 'continuous',
                }}
              >
                <AppIcon name="warning" color={theme.error} />
                <AppText
                  accessibilityRole="alert"
                  selectable
                  style={{ color: theme.error, flex: 1 }}
                >
                  {error}
                </AppText>
              </View>
            )}
            <View style={{ gap: spacing.sm }}>
              <ActionButton
                label={saving ? 'Saving correction' : 'Save correction'}
                icon="send"
                busy={saving}
                disabled={preparingLocation || problems.length > 0}
                onPress={() => void save()}
              />
              <AppText variant="caption" style={{ color: theme.muted }}>
                {problems.length
                  ? problems.join(' ')
                  : remaining > 0
                    ? `After this you can correct it ${remaining} more ${remaining === 1 ? 'time' : 'times'}.`
                    : 'This is the last correction allowed for this report.'}
              </AppText>
            </View>
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
