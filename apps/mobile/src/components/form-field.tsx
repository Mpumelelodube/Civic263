import { useAppReducedMotion } from '@/hooks/use-reduced-motion';
import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import Animated, { cubicBezier, FadeIn, ReduceMotion } from 'react-native-reanimated';
import { AppIcon, type IconName } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { motion, typography, useTheme } from '@/theme';

export function FormField({
  label,
  icon,
  hint,
  minimum = 0,
  value,
  onChangeText,
  ...props
}: Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  icon: IconName;
  hint: string;
  minimum?: number;
  value: string;
  onChangeText: (text: string) => void;
}) {
  const theme = useTheme();
  const reduced = useAppReducedMotion();
  const [focused, setFocused] = useState(false);
  const ready = value.trim().length >= Math.max(1, minimum);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AppIcon name={icon} size={20} color={focused ? theme.accent : theme.muted} />
        <AppText variant="label">{label}</AppText>
        {ready && (
          <Animated.View
            entering={FadeIn.duration(motion.feedback).reduceMotion(ReduceMotion.System)}
          >
            <AppIcon name="check" size={17} />
          </Animated.View>
        )}
      </View>
      <Animated.View
        style={{
          backgroundColor: theme.input,
          borderWidth: 1,
          borderRadius: 16,
          borderColor: focused ? theme.accent : theme.border,
          transitionProperty: 'borderColor',
          transitionDuration: reduced ? 0 : motion.field,
          transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
        }}
      >
        <TextInput
          {...props}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={theme.muted}
          selectionColor={theme.accent}
          cursorColor={theme.accent}
          keyboardAppearance={theme.scheme}
          textAlignVertical={props.multiline ? 'top' : 'center'}
          style={[
            typography.body,
            { color: theme.text, padding: 16, minHeight: props.multiline ? 128 : 56 },
          ]}
        />
      </Animated.View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <AppText variant="caption" style={{ color: theme.muted, flex: 1 }}>
          {hint}
        </AppText>
        {props.maxLength && (
          <AppText variant="caption" style={{ color: theme.muted, fontVariant: ['tabular-nums'] }}>
            {value.length}/{props.maxLength}
          </AppText>
        )}
      </View>
    </View>
  );
}
