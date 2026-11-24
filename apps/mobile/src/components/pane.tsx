import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { AppIcon, type IconName } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { radius, spacing, useTheme } from '@/theme';

/** Title block at the top of a pane or page: eyebrow, title, supporting line, trailing actions. */
export function PaneHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          {eyebrow && (
            <AppText variant="eyebrow" style={{ color: theme.accent }}>
              {eyebrow}
            </AppText>
          )}
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
        </View>
        {trailing}
      </View>
      {subtitle && <AppText style={{ color: theme.muted }}>{subtitle}</AppText>}
    </View>
  );
}

/**
 * A selectable list row for list/detail layouts. Selection and press are shown with a
 * background change, not a card or border, so long lists stay calm.
 */
export function ListRow({
  icon,
  title,
  meta,
  status,
  selected = false,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  title: string;
  meta?: string;
  status?: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, status, meta].filter(Boolean).join(', ')}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 64,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: selected ? theme.tint : pressed ? theme.input : 'transparent',
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.sm,
          borderCurve: 'continuous',
          backgroundColor: selected ? theme.surface : theme.tint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppIcon name={icon} size={21} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label" numberOfLines={2}>
          {title}
        </AppText>
        {status && (
          <AppText variant="caption" numberOfLines={1} style={{ color: theme.accent }}>
            {status}
          </AppText>
        )}
        {meta && (
          <AppText variant="caption" numberOfLines={1} style={{ color: theme.muted }}>
            {meta}
          </AppText>
        )}
      </View>
      <AppIcon name="chevron" size={16} color={selected ? theme.accent : theme.muted} />
    </Pressable>
  );
}

/** Shown in a detail pane before anything is selected. */
export function EmptyPane({
  icon,
  title,
  body,
  children,
}: PropsWithChildren<{ icon: IconName; title: string; body: string }>) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.section,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          backgroundColor: theme.tint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppIcon name={icon} size={34} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      <AppText style={{ color: theme.muted, textAlign: 'center', maxWidth: 420 }}>{body}</AppText>
      {children}
    </View>
  );
}

/** A compact row of figures (counts) grouped on one surface with hairline dividers. */
export function SummaryStrip({ items }: { items: { label: string; value: string | number }[] }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.input,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        paddingVertical: spacing.md,
      }}
    >
      {items.map((item, index) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.value} ${item.label}`}
          style={{
            flex: 1,
            alignItems: 'center',
            gap: 2,
            paddingHorizontal: spacing.sm,
            borderLeftWidth: index ? StyleSheet.hairlineWidth : 0,
            borderLeftColor: theme.border,
          }}
        >
          <AppText variant="heading" style={{ fontVariant: ['tabular-nums'] }}>
            {item.value}
          </AppText>
          <AppText
            variant="caption"
            numberOfLines={1}
            style={{ color: theme.muted, textAlign: 'center' }}
          >
            {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Platform segmented control (UISegmentedControl / Material segmented buttons). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <SegmentedControl
      values={options.map((option) => option.label)}
      selectedIndex={Math.max(
        0,
        options.findIndex((option) => option.value === value),
      )}
      onChange={(event) => {
        const next = options[event.nativeEvent.selectedSegmentIndex];
        if (next) onChange(next.value);
      }}
      tintColor={theme.accent}
      appearance={theme.scheme}
      accessibilityLabel={accessibilityLabel}
      style={[{ minHeight: 36 }, style]}
    />
  );
}

/** A filter chip (capsule) with an optional service icon and count. */
export function FilterChip({
  label,
  icon,
  count,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName;
  count?: number;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 36,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        backgroundColor: selected ? theme.accent : pressed ? theme.tint : theme.input,
      })}
    >
      {icon && <AppIcon name={icon} size={16} color={selected ? theme.onAccent : undefined} />}
      <AppText variant="caption" style={{ color: selected ? theme.onAccent : theme.text }}>
        {label}
      </AppText>
      {count !== undefined && (
        <AppText
          variant="caption"
          style={{
            color: selected ? theme.onAccent : theme.muted,
            fontVariant: ['tabular-nums'],
          }}
        >
          {count}
        </AppText>
      )}
    </Pressable>
  );
}
