import { useEffect, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/app-icon';
import { sheetSnap } from '@/components/sheet-snap';
import { useAppReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/theme';

// Keep React Native controls in a native Modal root; Compose-hosted scroll gestures crash in Expo Go 58.0.5.
export function BottomSheet({
  isPresented,
  onDismiss,
  children,
}: PropsWithChildren<{ isPresented: boolean; onDismiss: () => void }>) {
  const theme = useTheme();
  const reduced = useAppReducedMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const panelHeight = height - insets.top - 12;
  const half = panelHeight * 0.42;
  const [mounted, setMounted] = useState(isPresented);
  const [expanded, setExpanded] = useState(false);
  const y = useSharedValue(panelHeight);
  const start = useSharedValue(half);
  const scrim = useSharedValue(0);
  useEffect(() => {
    const config = {
      duration: reduced ? 0 : 200,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      reduceMotion: ReduceMotion.System,
    };
    if (isPresented) {
      setMounted(true);
      setExpanded(false);
      y.set(panelHeight);
      y.set(
        withSpring(half, { duration: 300, dampingRatio: 1, reduceMotion: ReduceMotion.System }),
      );
      scrim.set(withTiming(0.45, config));
    } else {
      scrim.set(withTiming(0, config));
      y.set(
        withTiming(panelHeight, config, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [isPresented, panelHeight, half, reduced, y, scrim]);
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));
  function toggle() {
    setExpanded(!expanded);
    y.set(
      withSpring(expanded ? half : 0, {
        duration: 300,
        dampingRatio: 1,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }
  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onActivate: () => {
      'worklet';
      start.set(y.get());
    },
    onUpdate: (event) => {
      'worklet';
      y.set(Math.max(0, start.get() + event.translationY));
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.canceled) {
        y.set(
          withSpring(expanded ? 0 : half, {
            duration: 300,
            dampingRatio: 1,
            reduceMotion: ReduceMotion.System,
          }),
        );
        return;
      }
      const snap = sheetSnap(y.get(), event.velocityY, half, panelHeight);
      if (snap === 'dismiss') {
        scheduleOnRN(onDismiss);
        return;
      }
      scheduleOnRN(setExpanded, snap === 'expanded');
      y.set(
        withSpring(snap === 'expanded' ? 0 : half, {
          duration: 300,
          dampingRatio: 0.8,
          velocity: event.velocityY,
          overshootClamping: true,
          reduceMotion: ReduceMotion.System,
        }),
      );
    },
  });
  if (!mounted) return null;
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
          onPress={onDismiss}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Animated.View
            pointerEvents="none"
            style={[{ flex: 1, backgroundColor: '#000000' }, scrimStyle]}
          />
        </Pressable>
        <Animated.View
          accessibilityViewIsModal
          style={[
            {
              position: 'absolute',
              top: insets.top + 12,
              left: 0,
              right: 0,
              height: panelHeight,
              backgroundColor: theme.surface,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              overflow: 'hidden',
            },
            panelStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={{ height: 52, flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Collapse sheet' : 'Expand sheet'}
                onPress={toggle}
                style={{
                  flex: 1,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingLeft: 48,
                }}
              >
                <View
                  style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.muted }}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close sheet"
                onPress={onDismiss}
                style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <AppIcon name="close" color={theme.muted} size={19} />
              </Pressable>
            </View>
          </GestureDetector>
          <View
            style={{
              height: Math.max(120, panelHeight - (expanded ? 0 : half) - 52 - insets.bottom),
            }}
          >
            {children}
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
