import { useAppReducedMotion } from '@/hooks/use-reduced-motion';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { AppIcon, type IconName } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { motion, useTheme } from '@/theme';

export function ActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  style,
  testID,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const theme = useTheme();
  const reduced = useAppReducedMotion();
  const [pressed, setPressed] = useState(false);
  const unavailable = disabled || busy;
  const color = variant === 'primary' ? theme.onAccent : theme.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: unavailable, busy }}
      disabled={unavailable}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={16}
      style={style}
    >
      <Animated.View
        style={{
          minHeight: 52,
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          backgroundColor:
            variant === 'primary'
              ? theme.accent
              : variant === 'secondary'
                ? theme.tint
                : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !reduced ? 0.97 : 1 }],
          transitionProperty: ['transform', 'opacity'],
          transitionDuration: reduced ? 0 : motion.press,
          transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={color} />
        ) : icon ? (
          <AppIcon name={icon} size={21} color={color} />
        ) : null}
        <AppText variant="label" style={{ color, flexShrink: 1, textAlign: 'center' }}>
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

export function IconBadge({ name, size = 42 }: { name: IconName; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: theme.tint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppIcon name={name} size={Math.round(size * 0.52)} />
    </View>
  );
}
