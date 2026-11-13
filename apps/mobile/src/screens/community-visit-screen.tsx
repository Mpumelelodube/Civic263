import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { FIELD_CHECK_LABELS } from '@civic263/domain';
import { readMyVisit } from '@/services/community';
import { AppText } from '@/components/app-text';
import { ActionButton } from '@/components/action-button';
import { useTheme } from '@/theme';

export function CommunityVisitScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [visit, setVisit] = useState<Awaited<ReturnType<typeof readMyVisit>> | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setError(false);
    setVisit(null);
    if (!id || !/^[a-f0-9]{40}$/.test(id)) {
      setError(true);
      return;
    }
    void readMyVisit(id)
      .then((value) => {
        if (active) setVisit(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 16,
          gap: 20,
          paddingBottom: 40,
        }}
      >
        <ActionButton
          label="Back to community"
          icon="close"
          variant="ghost"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/community');
          }}
        />
        <AppText variant="title">Your site visit</AppText>
        {error ? (
          <>
            <AppText style={{ color: theme.error }}>
              Could not load this visit. Its originals remain private to the identity that submitted
              it.
            </AppText>
            <ActionButton
              label="Retry visit"
              icon="retry"
              onPress={() => setRetry((value) => value + 1)}
            />
          </>
        ) : !visit ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <>
            <AppText variant="heading">{FIELD_CHECK_LABELS[visit.kind]}</AppText>
            <AppText>{visit.reference}</AppText>
            <AppText style={{ color: theme.muted }}>
              {new Date(visit.createdAt).toLocaleString()} · Your new camera originals
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {visit.photos.map((photo, index) => {
                const uri = `data:image/jpeg;base64,${photo.base64}`;
                return (
                  <Pressable
                    key={index}
                    style={{ width: '47%' }}
                    accessibilityRole="button"
                    accessibilityLabel={`Open your visit photo ${index + 1}`}
                    onPress={() => setImage(uri)}
                  >
                    <Image
                      source={{ uri }}
                      style={{ width: '100%', aspectRatio: 1, borderRadius: 14 }}
                      contentFit="cover"
                      cachePolicy="none"
                      accessibilityLabel={`Your private visit photo ${index + 1}`}
                    />
                  </Pressable>
                );
              })}
            </View>
            <ActionButton
              label="View issue and community history"
              icon="nearby"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/report-details',
                  params: { id: visit.reportId, view: 'public' },
                })
              }
            />
          </>
        )}
      </ScrollView>
      <Modal visible={!!image} animationType="fade" onRequestClose={() => setImage(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <ActionButton
            label="Close photo"
            icon="close"
            variant="ghost"
            onPress={() => setImage(null)}
          />
          {image && (
            <Image
              source={{ uri: image }}
              style={{ flex: 1 }}
              contentFit="contain"
              cachePolicy="none"
              accessibilityLabel="Your enlarged private visit photo"
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
