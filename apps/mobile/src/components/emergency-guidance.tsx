import { Linking, Pressable, View } from 'react-native';
import { EMERGENCY_GUIDANCE, NOT_AN_EMERGENCY_SERVICE } from '@civic263/domain';
import { AppText } from '@/components/app-text';
import { AppIcon } from '@/components/app-icon';
import { radius, spacing, useTheme } from '@/theme';

/** Shown for services where someone may be in danger. Civic263 itself never dispatches help. */
export function EmergencyGuidance() {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="summary"
      style={{
        gap: spacing.sm,
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: theme.surface,
        borderLeftWidth: 4,
        borderLeftColor: theme.error,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AppIcon name="warning" color={theme.error} />
        <AppText variant="label" accessibilityRole="header">
          Is anyone in danger right now?
        </AppText>
      </View>
      <AppText style={{ color: theme.muted }}>{NOT_AN_EMERGENCY_SERVICE}</AppText>
      {EMERGENCY_GUIDANCE.numbers.map((item) => (
        <Pressable
          key={item.number}
          accessibilityRole="link"
          accessibilityLabel={`Call ${item.number}, ${item.label}`}
          onPress={() => void Linking.openURL(`tel:${item.number.replaceAll(' ', '')}`)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.md,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <AppText style={{ flex: 1 }}>{item.label}</AppText>
          <AppText variant="label" selectable style={{ color: theme.accent }}>
            {item.number}
          </AppText>
        </Pressable>
      ))}
      <AppText variant="caption" style={{ color: theme.muted }}>
        Numbers from {EMERGENCY_GUIDANCE.source}, checked{' '}
        {new Date(EMERGENCY_GUIDANCE.checkedOn).toLocaleDateString()}.
      </AppText>
    </View>
  );
}
