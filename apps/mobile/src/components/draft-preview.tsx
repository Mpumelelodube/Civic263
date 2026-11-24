import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { categoryLabel, type ReportDraft } from '@civic263/domain';
import { ActionButton, IconBadge } from '@/components/action-button';
import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { radius, spacing, useTheme } from '@/theme';

/** A device draft (or a sent draft awaiting its server record) shown in a detail pane. */
export function DraftPreview({ draft }: { draft: ReportDraft }) {
  const theme = useTheme();
  const status = draft.receipt
    ? draft.receipt.testOnly
      ? 'TEST SERVER RECEIPT'
      : 'RECEIVED BY CIVIC263'
    : draft.submissionStartedAt
      ? 'DELIVERY UNCONFIRMED'
      : 'DEVICE DRAFT';
  const photos = draft.photos ?? [];
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.section,
        gap: spacing.xl,
        width: '100%',
        maxWidth: 760,
        alignSelf: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconBadge name={draft.categoryId} />
        <AppText variant="eyebrow" style={{ color: theme.accent }}>
          {status}
        </AppText>
      </View>
      <AppText variant="title" accessibilityRole="header">
        {categoryLabel(draft.categoryId)}
      </AppText>
      {draft.receipt && (
        <AppText variant="label" selectable>
          {draft.receipt.reference}
        </AppText>
      )}
      <AppText selectable>{draft.description || 'No description yet.'}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <AppIcon name="pin" size={18} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ color: theme.muted }}>{draft.landmark || 'No place added yet'}</AppText>
          <AppText variant="caption" style={{ color: theme.muted }}>
            {draft.location
              ? `Pin ${draft.location.latitude.toFixed(5)}, ${draft.location.longitude.toFixed(5)}`
              : 'No map pin confirmed'}
          </AppText>
        </View>
      </View>
      {photos.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {photos.map((photo, index) => (
            <Image
              key={photo.id}
              source={{ uri: photo.uri }}
              style={{
                width: '31.5%',
                aspectRatio: 1,
                borderRadius: radius.md,
                borderCurve: 'continuous',
              }}
              contentFit="cover"
              accessibilityLabel={`Saved report photo ${index + 1}`}
            />
          ))}
        </View>
      )}
      <AppText variant="caption" style={{ color: theme.muted }}>
        {photos.length} {photos.length === 1 ? 'photo' : 'photos'} · Saved{' '}
        {new Date(draft.updatedAt).toLocaleString()}
        {draft.receipt ? '' : ' · Stored on this device only'}
      </AppText>
      {!draft.receipt && (
        <ActionButton
          label={draft.submissionStartedAt ? 'Check or retry delivery' : 'Continue this draft'}
          icon={draft.submissionStartedAt ? 'retry' : 'edit'}
          onPress={() => router.push({ pathname: '/report', params: { draftId: draft.id } })}
          style={{ alignSelf: 'flex-start', minWidth: 260 }}
        />
      )}
    </ScrollView>
  );
}
