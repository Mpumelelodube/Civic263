import { useState } from 'react';
import { View } from 'react-native';
import {
  COMPLAINT_NOTE_MAX,
  COMPLAINT_REASONS,
  RESPONSE_TARGET_WORKING_DAYS,
  type ComplaintReason,
  type ComplaintTarget,
} from '@civic263/domain';
import { AppText } from './app-text';
import { ActionButton } from './action-button';
import { FormField } from './form-field';
import { SheetAction } from './sheet-content';
import { reportConcern } from '@/services/moderation';
import { spacing, useTheme } from '@/theme';

const TITLES: Record<ComplaintTarget['type'], string> = {
  issue: 'Report this issue',
  photo: 'Report this photo',
  check: 'Report these visit photos',
};

/**
 * Reporting public content. Shared by the issue sheet and the photo viewer so two native
 * modals never have to be presented at once.
 */
export function ConcernForm({ target, onClose }: { target: ComplaintTarget; onClose: () => void }) {
  const theme = useTheme();
  const [reason, setReason] = useState<ComplaintReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (sent)
    return (
      <View style={{ gap: spacing.lg }}>
        <AppText variant="title" accessibilityRole="header">
          Thank you
        </AppText>
        <AppText accessibilityLiveRegion="polite">
          A Civic263 reviewer will look at it within {RESPONSE_TARGET_WORKING_DAYS} working days.
          Reports about personal information or danger are checked first. If several people report
          the same thing, it is hidden until then.
        </AppText>
        <ActionButton label="Done" icon="check" onPress={onClose} />
      </View>
    );
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title" accessibilityRole="header">
          {TITLES[target.type]}
        </AppText>
        <AppText style={{ color: theme.muted }}>
          Tell a reviewer what is wrong. Your report is private; the person who posted this is not
          told who reported it.
        </AppText>
      </View>
      <View accessibilityRole="radiogroup" style={{ gap: spacing.xs }}>
        {(Object.keys(COMPLAINT_REASONS) as ComplaintReason[]).map((key) => (
          <SheetAction
            key={key}
            label={COMPLAINT_REASONS[key]}
            icon={key === 'personal-information' ? 'lock' : key === 'unsafe' ? 'warning' : 'edit'}
            selected={reason === key}
            onPress={() => {
              setReason(key);
              setError(null);
            }}
          />
        ))}
      </View>
      <FormField
        label="Anything a reviewer should know? (optional)"
        icon="edit"
        hint={`Up to ${COMPLAINT_NOTE_MAX} characters. Do not include your own contact details.`}
        maxLength={COMPLAINT_NOTE_MAX}
        multiline
        value={note}
        onChangeText={setNote}
        editable={!sending}
      />
      {error && (
        <AppText accessibilityRole="alert" selectable style={{ color: theme.error }}>
          {error}
        </AppText>
      )}
      <ActionButton
        label={sending ? 'Sending report' : 'Send report'}
        icon="send"
        busy={sending}
        disabled={!reason}
        onPress={() => {
          if (!reason) return;
          setSending(true);
          setError(null);
          reportConcern(target, reason, note)
            .then(() => setSent(true))
            .catch((reasonError: unknown) =>
              setError(
                reasonError instanceof Error && reasonError.message
                  ? reasonError.message
                  : 'Could not send the report. Check your connection and retry.',
              ),
            )
            .finally(() => setSending(false));
        }}
      />
      <ActionButton
        label="Cancel"
        icon="close"
        variant="ghost"
        disabled={sending}
        onPress={onClose}
      />
    </View>
  );
}
