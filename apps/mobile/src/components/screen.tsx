import type { PropsWithChildren } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { theme } from '@/theme';
export function Screen({ children }: PropsWithChildren) {
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
  return <Text style={{ color: theme.muted, fontSize: 16, lineHeight: 24 }}>{children}</Text>;
}
export function Panel({ children }: PropsWithChildren) {
  return (
    <View
      style={{ backgroundColor: theme.surface, padding: 18, borderRadius: theme.radius, gap: 12 }}
    >
      {children}
    </View>
  );
}
