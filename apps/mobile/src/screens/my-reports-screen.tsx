import { Button, Host } from '@expo/ui';
import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { categoryLabel, type ReportDraft } from '@civic263/domain';
import { loadDrafts } from '@/services/drafts';
import { theme } from '@/theme';
export function MyReportsScreen() {
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      void loadDrafts()
        .then((items) => {
          if (active) setDrafts(items);
        })
        .catch(() => {
          if (active) setError('Could not read saved drafts. They have not been deleted.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [reloadKey]),
  );
  return (
    <FlatList
      data={drafts}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}
      style={{ flex: 1, backgroundColor: theme.background }}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: theme.text }}>
            Saved on this device
          </Text>
          <Text style={{ fontSize: 16, color: theme.muted, lineHeight: 24 }}>
            These are local drafts. They have not been received by Civic263 or a municipality.
          </Text>
          {error && (
            <>
              <Text accessibilityRole="alert" style={{ color: theme.error }}>
                {error}
              </Text>
              <Host matchContents>
                <Button onPress={() => setReloadKey((value) => value + 1)}>
                  Retry loading drafts
                </Button>
              </Host>
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <Text style={{ color: theme.muted }}>Loading drafts...</Text>
        ) : !error ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: theme.muted, fontSize: 16 }}>No issue drafts saved yet.</Text>
            <Host matchContents>
              <Button onPress={() => router.push('/report')}>Start an issue draft</Button>
            </Host>
          </View>
        ) : (
          <></>
        )
      }
      renderItem={({ item }) => (
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: theme.radius,
            padding: 18,
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>
            {categoryLabel(item.categoryId)}
          </Text>
          <Text style={{ color: theme.text, fontSize: 16 }}>{item.description}</Text>
          <Text style={{ color: theme.muted, fontSize: 14 }}>{item.landmark}</Text>
          <Text style={{ color: theme.muted, fontSize: 12 }}>
            Draft / {new Date(item.updatedAt).toLocaleString()}
          </Text>
        </View>
      )}
    />
  );
}
