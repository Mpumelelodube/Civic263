import { BottomSheet } from '@/components/bottom-sheet';
import { ScrollView as SheetScrollView } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Keyboard, Pressable, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  CATEGORIES,
  PHOTO_LIMITS,
  categoryLabel,
  type CategoryId,
  type DraftPhoto,
  type ReportDraft,
  type ReportLocation,
} from '@civic263/domain';
import { SheetAction, SheetBlock } from '@/components/sheet-content';
import { AppText } from '@/components/app-text';
import { AppIcon } from '@/components/app-icon';
import { ActionButton, IconBadge } from '@/components/action-button';
import { FormField } from '@/components/form-field';
import { loadDraft, saveDraft, updateDraft } from '@/services/drafts';
import { submitDraft, submissionError } from '@/services/report-submission';
import { intakeEnabled } from '@/services/firebase';
import { ReportPhotos } from '@/components/report-photos';
import { ReportLocationField } from '@/components/report-location';
import { motion, useTheme } from '@/theme';

export function ReportScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabHeight = useBottomTabBarHeight();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const savingRef = useRef(false);
  const currentDraft = useRef<ReportDraft | null>(null);
  const formScroll = useRef<KeyboardAwareScrollViewRef>(null);
  const [categoryId, setCategoryId] = useState<CategoryId>('roads');
  const [showCategories, setShowCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [footerHeight, setFooterHeight] = useState(112);
  const [description, setDescription] = useState('');
  const [landmark, setLandmark] = useState('');
  const [location, setLocation] = useState<ReportLocation | undefined>(undefined);
  const [preparingLocation, setPreparingLocation] = useState(false);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [preparingPhotos, setPreparingPhotos] = useState(false);
  const [locked, setLocked] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const disabled = saving || loadingDraft || locked;
  useEffect(() => {
    if (!draftId) return;
    let active = true;
    setLoadingDraft(true);
    void loadDraft(draftId)
      .then((draft) => {
        if (!active) return;
        if (draft.receipt) {
          router.navigate('/my-reports');
          return;
        }
        currentDraft.current = draft;
        setCategoryId(draft.categoryId);
        setDescription(draft.description);
        setLandmark(draft.landmark);
        setLocation(draft.location);
        setPhotos(draft.photos ?? []);
        setLocked(!!draft.submissionStartedAt);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Could not load this draft.');
      })
      .finally(() => {
        if (active) setLoadingDraft(false);
      });
    return () => {
      active = false;
    };
  }, [draftId]);
  async function save(send = false) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSending(send);
    setError(null);
    try {
      let draft = currentDraft.current;
      if (!draft) draft = await saveDraft({ categoryId, description, landmark, photos, location });
      else if (!draft.submissionStartedAt)
        draft = await updateDraft({
          ...draft,
          categoryId,
          description,
          landmark,
          photos,
          location,
          updatedAt: new Date().toISOString(),
        });
      currentDraft.current = draft;
      if (send) {
        draft = await submitDraft(draft);
        currentDraft.current = draft;
      }
      Keyboard.dismiss();
      formScroll.current?.scrollTo({ y: 0, animated: false });
      setDescription('');
      setLandmark('');
      setLocation(undefined);
      setPhotos([]);
      setLocked(false);
      currentDraft.current = null;
      router.setParams({ draftId: undefined });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.navigate({ pathname: '/my-reports', params: { savedId: draft.id } });
    } catch (reason) {
      if (currentDraft.current) {
        const saved = await loadDraft(currentDraft.current.id).catch(() => null);
        if (saved) {
          currentDraft.current = saved;
          setLocked(!!saved.submissionStartedAt);
        }
      }
      setError(submissionError(reason));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      savingRef.current = false;
      setSaving(false);
      setSending(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAwareScrollView
        ref={formScroll}
        bottomOffset={footerHeight + 24}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 20,
          paddingBottom: footerHeight + 40,
          gap: 28,
        }}
      >
        <View style={{ gap: 8 }}>
          <AppText variant="eyebrow" style={{ color: theme.accent }}>
            NOTICE SOMETHING?
          </AppText>
          <AppText variant="title">Make it a useful report.</AppText>
          <AppText style={{ color: theme.muted }}>
            A service, a few details, a place and photos that help explain the issue.
          </AppText>
        </View>
        <View style={{ gap: 12 }}>
          <AppText variant="eyebrow" style={{ color: theme.muted }}>
            01 / CHOOSE A SERVICE
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Service: ${categoryLabel(categoryId)}. Choose a service.`}
            disabled={disabled}
            onPress={() => {
              Keyboard.dismiss();
              setShowCategories(true);
            }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? theme.tint : theme.surface,
              borderRadius: 18,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            })}
          >
            <IconBadge name={categoryId} />
            <View style={{ flex: 1, gap: 3 }}>
              <AppText variant="label">{categoryLabel(categoryId)}</AppText>
              <AppText variant="caption" style={{ color: theme.muted }}>
                Tap to change service
              </AppText>
            </View>
            <AppIcon name="chevron" size={20} color={theme.muted} />
          </Pressable>
        </View>
        <View style={{ gap: 16 }}>
          <AppText variant="eyebrow" style={{ color: theme.muted }}>
            02 / TELL US WHAT YOU SAW
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
            placeholder="e.g. A deep pothole is blocking the left lane…"
            editable={!disabled}
          />
        </View>
        <View style={{ gap: 16 }}>
          <AppText variant="eyebrow" style={{ color: theme.muted }}>
            03 / ADD THE PLACE
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

        <View style={{ gap: 16 }}>
          <AppText variant="eyebrow" style={{ color: theme.muted }}>
            04 / ADD THE EVIDENCE
          </AppText>
          <ReportPhotos
            photos={photos}
            onChange={setPhotos}
            disabled={disabled}
            onBusyChange={setPreparingPhotos}
            preserveRemovedPhotos={!!currentDraft.current}
          />
        </View>
        {locked && (
          <AppText style={{ color: theme.muted }}>
            Delivery has started. The details are held unchanged so retrying checks the same report.
          </AppText>
        )}
        <AppText variant="caption" style={{ color: theme.muted }}>
          {intakeEnabled
            ? 'Sending saves a device copy first. Automatic checks may publish a cleaned summary, approved photos and an approximate map position. Your reporting identity and original uploads stay private. A receipt confirms platform intake, not municipal acknowledgement.'
            : 'Server submission is not enabled for this build. Save your details and compressed photos on this device for now.'}{' '}
          Clearing app data can remove drafts and your device reporting identity.
        </AppText>
      </KeyboardAwareScrollView>
      {!keyboardVisible && (
        <KeyboardStickyView
          offset={{ opened: tabHeight }}
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            gap: 9,
            backgroundColor: theme.navigation,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          {error && (
            <Animated.View
              entering={FadeIn.duration(motion.feedback).reduceMotion(ReduceMotion.System)}
              style={{
                flexDirection: 'row',
                gap: 10,
                padding: 16,
                backgroundColor: theme.surface,
                borderRadius: 16,
              }}
            >
              <AppIcon name="warning" color={theme.error} />
              <AppText accessibilityRole="alert" style={{ color: theme.error, flex: 1 }}>
                {error}
              </AppText>
            </Animated.View>
          )}
          <ActionButton
            label={
              sending ? 'Sending compressed photos...' : locked ? 'Retry delivery' : 'Send report'
            }
            icon="send"
            busy={saving}
            disabled={
              !intakeEnabled ||
              photos.length > PHOTO_LIMITS.maximum ||
              preparingPhotos ||
              preparingLocation ||
              loadingDraft
            }
            onPress={() => {
              void save(true);
            }}
            testID="send-report"
          />
          <ActionButton
            label={
              saving && !sending
                ? 'Saving your draft...'
                : locked
                  ? 'Return to saved draft'
                  : 'Save draft on this device'
            }
            icon="drafts"
            variant="ghost"
            disabled={saving || preparingPhotos || preparingLocation || loadingDraft}
            onPress={() => {
              if (locked) router.navigate('/my-reports');
              else void save();
            }}
            testID="save-draft"
          />
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <AppIcon name="lock" size={13} color={theme.muted} />
            <AppText variant="caption" style={{ color: theme.muted }}>
              {intakeEnabled
                ? `${photos.length} / ${PHOTO_LIMITS.maximum} photos · optional`
                : 'Device draft / live sending needs setup'}
            </AppText>
          </View>
        </KeyboardStickyView>
      )}
      <BottomSheet isPresented={showCategories} onDismiss={() => setShowCategories(false)}>
        <SheetScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 16, width: '100%', padding: 20, paddingBottom: 40 }}>
            <SheetBlock>
              <AppText variant="title">Choose a service</AppText>
              <AppText style={{ color: theme.muted }}>
                Choose the closest match. You can change it before saving.
              </AppText>
            </SheetBlock>
            {CATEGORIES.map((category) => (
              <SheetAction
                key={category.id}
                label={category.label}
                icon={category.id}
                selected={categoryId === category.id}
                onPress={() => {
                  setCategoryId(category.id);
                  setShowCategories(false);
                  void Haptics.selectionAsync().catch(() => {});
                }}
              />
            ))}
          </View>
        </SheetScrollView>
      </BottomSheet>
    </View>
  );
}
