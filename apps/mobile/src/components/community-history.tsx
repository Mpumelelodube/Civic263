import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { FIELD_CHECK_LABELS, type PublicFieldCheck } from '@civic263/domain';
import { fieldCheckPhotoUrl, readFieldChecks } from '@/services/community';
import { AppText } from './app-text';
import { ActionButton } from './action-button';
import { useTheme } from '@/theme';

export function CommunityHistory({
  reportId,
  version,
  onPhoto,
}: {
  reportId: string;
  version: number;
  onPhoto: (uri: string) => void;
}) {
  const theme = useTheme();
  const [items, setItems] = useState<PublicFieldCheck[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(true);
  const [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 20000);
      setBusy(true);
      setError(false);
      void readFieldChecks(reportId, abort.signal)
        .then((result) => {
          if (active) {
            setItems(result.items);
            setCursor(result.nextCursor);
          }
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          clearTimeout(timer);
          if (active) setBusy(false);
        });
      return () => {
        active = false;
        abort.abort();
        clearTimeout(timer);
      };
    }, [reportId, version, retry]),
  );
  async function more() {
    if (!cursor || busy) return;
    setBusy(true);
    setError(false);
    try {
      const result = await readFieldChecks(reportId, AbortSignal.timeout(20000), cursor);
      setItems((current) => [
        ...new Map([...current, ...result.items].map((item) => [item.id, item])).values(),
      ]);
      setCursor(result.nextCursor);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 14 }}>
      <AppText variant="heading">Community evidence history</AppText>
      {busy && !items.length && (
        <AppText style={{ color: theme.muted }}>Loading site visits…</AppText>
      )}
      {error && (
        <>
          <AppText style={{ color: theme.error }}>Could not refresh the visit history.</AppText>
          <ActionButton
            label="Retry visit history"
            icon="retry"
            variant="ghost"
            onPress={() => setRetry((value) => value + 1)}
          />
        </>
      )}
      {!busy && !error && !items.length && (
        <AppText style={{ color: theme.muted }}>No community visits recorded yet.</AppText>
      )}
      {items.map((item) => (
        <View
          key={item.id}
          style={{ gap: 8, paddingVertical: 12, borderTopWidth: 1, borderColor: theme.border }}
        >
          <AppText variant="label">{FIELD_CHECK_LABELS[item.kind]}</AppText>
          <AppText variant="caption" style={{ color: theme.muted }}>
            {new Date(item.createdAt).toLocaleString()} ·{' '}
            {item.evidenceStatus === 'pending'
              ? 'Photos awaiting privacy checks'
              : item.photoCount
                ? 'Photos cleared for public viewing'
                : 'Photos kept private'}
          </AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Array.from({ length: item.photoCount }, (_, index) => {
              const uri = fieldCheckPhotoUrl(reportId, item.id, index);
              return (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${FIELD_CHECK_LABELS[item.kind]} photo ${index + 1}`}
                  style={{ width: '30%' }}
                  onPress={() => onPhoto(uri)}
                >
                  <Image
                    source={{ uri }}
                    style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
                    contentFit="cover"
                    accessibilityLabel={`Community visit photo ${index + 1}`}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {cursor && (
        <ActionButton
          label="More community visits"
          icon="arrow"
          variant="ghost"
          busy={busy}
          onPress={() => void more()}
        />
      )}
    </View>
  );
}
