import type { PropsWithChildren } from 'react';
import { ScrollView, View } from 'react-native';
import { AppText as Text } from '@/components/app-text';
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
