import type { PropsWithChildren } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/theme';
export function Screen({ children }: PropsWithChildren) {
  const theme = useTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
      style={{ flex: 1, backgroundColor: theme.background }}
    >
      {children}
    </ScrollView>
  );
}
/**
 * Centres content in a readable column on large screens instead of stretching it edge to edge.
 * `wide` allows the two-pane width used by forms and detail pages.
 */
export function ContentColumn({
  children,
  wide = false,
  style,
}: PropsWithChildren<{ wide?: boolean; style?: ViewStyle }>) {
  const layout = useLayout();
  return (
    <View
      style={[
        {
          width: '100%',
          alignSelf: 'center',
          maxWidth: wide ? layout.wideContentMaxWidth : layout.contentMaxWidth,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
/** Lays children out in the current number of columns, or one column on phones. */
export function ResponsiveGrid({
  children,
  gap = 16,
  columns,
}: PropsWithChildren<{ gap?: number; columns?: 1 | 2 | 3 }>) {
  const layout = useLayout();
  const count = columns ?? layout.columns;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'stretch' }}>
      {(Array.isArray(children) ? children : [children]).map((child, index) => (
        <View
          key={index}
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: count === 1 ? '100%' : `${Math.floor(100 / count) - 2}%`,
            minWidth: 0,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
export function Paragraph({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={{ color: theme.muted, fontSize: 16, lineHeight: 24 }}>{children}</Text>;
}
export function Panel({ children }: PropsWithChildren) {
  const theme = useTheme();
  return (
    <View
      style={{ backgroundColor: theme.surface, padding: 18, borderRadius: theme.radius, gap: 12 }}
    >
      {children}
    </View>
  );
}
