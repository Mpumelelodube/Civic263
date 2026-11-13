import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { PHOTO_LIMITS, type DraftPhoto } from '@civic263/domain';
import { compressPhoto, removePhotoFile } from '@/services/photos';
import { AppIcon } from './app-icon';
import { AppText } from './app-text';
import { ActionButton } from './action-button';
import { useTheme } from '@/theme';

export function ReportPhotos({
  photos,
  onChange,
  disabled,
  onBusyChange,
  preserveRemovedPhotos,
}: {
  photos: DraftPhoto[];
  onChange: (photos: DraftPhoto[]) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  preserveRemovedPhotos: boolean;
}) {
  const theme = useTheme();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function choose(camera: boolean) {
    if (busyRef.current || disabled || photos.length >= PHOTO_LIMITS.maximum) return;
    busyRef.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    const added: DraftPhoto[] = [];
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
        throw new Error('Allow camera access in settings or choose photos from your library.');
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], exif: false, quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: PHOTO_LIMITS.maximum - photos.length,
            exif: false,
            quality: 1,
          });
      if (result.canceled) return;
      for (const asset of result.assets.slice(0, PHOTO_LIMITS.maximum - photos.length))
        added.push(await compressPhoto(asset));
      onChange([...photos, ...added]);
    } catch (reason) {
      added.forEach(removePhotoFile);
      setError(
        reason instanceof Error ? reason.message : 'Could not prepare these photos. Try again.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <AppText variant="label" style={{ flex: 1 }}>
          Show what needs attention
        </AppText>
        <AppText variant="caption" accessibilityLiveRegion="polite" style={{ color: theme.accent }}>
          {photos.length} / {PHOTO_LIMITS.maximum} maximum
        </AppText>
      </View>
      <AppText variant="caption" style={{ color: theme.muted }}>
        Photos are optional. Add up to 3 different photos; we compress them before sending. Avoid
        faces, number plates and personal documents.
      </AppText>
      {photos.length > PHOTO_LIMITS.maximum && (
        <AppText style={{ color: theme.error }}>
          Remove extra photos to send this report. The maximum is {PHOTO_LIMITS.maximum}.
        </AppText>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {photos.map((photo, index) => (
          <View key={photo.id} style={{ width: '30%', gap: 5 }}>
            <Image
              source={{ uri: photo.uri }}
              style={{ width: '100%', aspectRatio: 1, borderRadius: 14 }}
              contentFit="cover"
              accessibilityLabel={`Report photo ${index + 1}`}
            />
            {!disabled && !busy && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                onPress={() => {
                  onChange(photos.filter((item) => item.id !== photo.id));
                  if (!preserveRemovedPhotos) removePhotoFile(photo);
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View style={{ padding: 5, borderRadius: 20, backgroundColor: theme.surface }}>
                  <AppIcon name="close" size={18} />
                </View>
              </Pressable>
            )}
            <AppText variant="caption" style={{ color: theme.muted }}>
              {Math.ceil(photo.bytes / 1024)} KB
            </AppText>
          </View>
        ))}
      </View>
      {busy ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <ActivityIndicator color={theme.accent} />
          <AppText variant="caption">Preparing compressed photos...</AppText>
        </View>
      ) : (
        photos.length < PHOTO_LIMITS.maximum &&
        !disabled && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ActionButton
              label="Choose photos"
              icon="photos"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                void choose(false);
              }}
            />
            <ActionButton
              label="Camera"
              icon="camera"
              variant="ghost"
              onPress={() => {
                void choose(true);
              }}
            />
          </View>
        )
      )}
      {error && (
        <AppText accessibilityRole="alert" variant="caption" style={{ color: theme.error }}>
          {error}
        </AppText>
      )}
    </View>
  );
}
