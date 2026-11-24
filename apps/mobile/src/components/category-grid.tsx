import { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CATEGORIES, type CategoryId } from '@civic263/domain';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Large screens: every service visible at once as a grid of tiles, so choosing a service is
 * one tap instead of opening a sheet and scrolling. Phones keep the service sheet.
 */
export function CategoryGrid({
  value,
  onChange,
  columns,
  disabled = false,
}: {
  value: CategoryId;
  onChange: (value: CategoryId) => void;
  columns: number;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const gap = spacing.sm;
  const tile = width ? Math.floor((width - gap * (columns - 1)) / columns) : 0;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Service"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
    >
      {tile > 0 &&
        CATEGORIES.map((category) => {
          const selected = category.id === value;
          return (
            <Pressable
              key={category.id}
              accessibilityRole="radio"
              accessibilityLabel={category.label}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => {
                if (selected) return;
                onChange(category.id);
                void Haptics.selectionAsync().catch(() => {});
              }}
              style={({ pressed }) => ({
                width: tile,
                minHeight: 92,
                padding: spacing.md,
                gap: spacing.sm,
                justifyContent: 'space-between',
                borderRadius: radius.lg,
                borderCurve: 'continuous',
                backgroundColor: selected ? theme.tint : pressed ? theme.input : theme.surface,
                // Selection ring drawn inside the tile so the grid never shifts.
                boxShadow: selected ? `inset 0 0 0 2px ${theme.accent}` : undefined,
                opacity: disabled && !selected ? 0.5 : 1,
              })}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <AppIcon name={category.id} size={26} />
                {selected && <AppIcon name="check" size={18} />}
              </View>
              <AppText variant="label" numberOfLines={2}>
                {category.label}
              </AppText>
            </Pressable>
          );
        })}
    </View>
  );
}
