import { Pressable, View } from 'react-native';
import type { PropsWithChildren } from 'react';
import { AppIcon, type IconName } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme';

export function SheetAction({
  label,
  detail,
  icon,
  selected = false,
  primary = false,
  onPress,
}: {
  label: string;
  detail?: string;
  icon: IconName;
  selected?: boolean;
  primary?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        padding: 14,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: primary ? theme.accent : selected || pressed ? theme.tint : 'transparent',
      })}
    >
      <AppIcon name={icon} color={primary ? theme.onAccent : theme.accent} />
      <View style={{ flex: 1, gap: 4 }}>
        {detail && (
          <AppText variant="caption" style={{ color: theme.accent }}>
            {detail}
          </AppText>
        )}
        <AppText variant="label" style={{ color: primary ? theme.onAccent : theme.text }}>
          {label}
        </AppText>
      </View>
      <AppIcon
        name={selected ? 'check' : primary ? 'arrow' : 'chevron'}
        size={20}
        color={primary ? theme.onAccent : theme.accent}
      />
    </Pressable>
  );
}

export function SheetBlock({ children }: PropsWithChildren) {
  return <View style={{ gap: 16 }}>{children}</View>;
}
