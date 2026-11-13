import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { CommunityContext, FieldCheckKind } from '@civic263/domain';
import { getCommunityContext } from '@/services/community';
import { ActionButton } from './action-button';
import { AppText } from './app-text';
import { useTheme } from '@/theme';

export function CommunityActions({
  reportId,
  version,
  disabled,
  onStart,
}: {
  reportId: string;
  version: number;
  disabled: boolean;
  onStart: (kind: FieldCheckKind, fixId?: string) => void;
}) {
  const theme = useTheme();
  const [context, setContext] = useState<CommunityContext | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setContext(null);
      setError(false);
      void getCommunityContext(reportId)
        .then((value) => {
          if (active) setContext(value);
        })
        .catch(() => {
          if (active) setError(true);
        });
      return () => {
        active = false;
      };
    }, [reportId, version, retry]),
  );
  return (
    <View style={{ gap: 12 }}>
      <AppText variant="heading">Community visits</AppText>
      {error && (
        <>
          <AppText style={{ color: theme.error }}>Could not refresh your review options.</AppText>
          <ActionButton
            label="Retry review options"
            icon="retry"
            variant="secondary"
            onPress={() => setRetry((value) => value + 1)}
          />
        </>
      )}
      {!context && !error && (
        <AppText style={{ color: theme.muted }}>Checking the latest issue status…</AppText>
      )}
      {context?.canReportFix && (
        <ActionButton
          label="Report a fix"
          icon="check"
          variant="secondary"
          disabled={disabled || error || !context.hasSite}
          onPress={() => onStart('report-fix')}
        />
      )}
      {context?.communityResolution?.status === 'awaiting-confirmation' && (
        <>
          <AppText style={{ color: theme.muted }}>
            A fix has been reported. The pin stays visible until a different resident checks the
            site.
          </AppText>
          {context.ownProposal ? (
            <AppText style={{ color: theme.muted }}>
              Your fix is waiting for another resident to confirm it.
            </AppText>
          ) : context.canReview ? (
            <>
              <ActionButton
                label="Confirm fixed on site"
                icon="check"
                disabled={disabled || error || !context.hasSite}
                onPress={() => onStart('confirm-fix', context.communityResolution!.fixId)}
              />
              <ActionButton
                label="Still broken"
                icon="warning"
                variant="secondary"
                disabled={disabled || error || !context.hasSite}
                onPress={() => onStart('reject-fix', context.communityResolution!.fixId)}
              />
            </>
          ) : (
            <ActionButton
              label="Join community reviewers"
              icon="check"
              variant="secondary"
              disabled={disabled}
              onPress={() => router.push('/community')}
            />
          )}
        </>
      )}
      {context && !context.hasSite && (
        <AppText style={{ color: theme.muted }}>
          This older issue has no saved site pin for a location check.
        </AppText>
      )}
    </View>
  );
}
