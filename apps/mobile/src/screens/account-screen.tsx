import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/app-text';
import { ActionButton, IconBadge } from '@/components/action-button';
import { FormField } from '@/components/form-field';
import { identityError } from '@/services/identity-commands';
import {
  residentAccount,
  saveResidentIdentity,
  signInResident,
  resetResidentPassword,
  verifyResidentEmail,
  refreshResidentAccount,
} from '@/services/identity';
import { useTheme } from '@/theme';

type Account = Awaited<ReturnType<typeof residentAccount>>;
export function AccountScreen() {
  const lock = useRef(false);
  const theme = useTheme(),
    insets = useSafeAreaInsets();
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<'save' | 'signin' | 'reset'>('save');
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setAccount(await residentAccount());
      setError(null);
    } catch (reason) {
      setError(identityError(reason));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        setPassword('');
        setConfirmation('');
      };
    }, [load]),
  );
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (reason) {
      setError(identityError(reason));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit() {
    await run(async () => {
      if (mode === 'reset') {
        await resetResidentPassword(email);
        setNotice(
          'If an account uses that email, a password reset link has been requested. Check its inbox.',
        );
        return;
      }
      if (mode === 'save') {
        if (password !== confirmation) throw new Error('The passwords do not match.');
        setAccount(await saveResidentIdentity(email, password));
        setNotice(
          'Your reporting identity is saved. Existing reports and site visits stay with this account.',
        );
      } else {
        setAccount(await signInResident(email, password));
        setNotice('Signed in. Your account reports can now be loaded on this device.');
      }
      setPassword('');
      setConfirmation('');
    });
  }
  return (
    <KeyboardAwareScrollView
      bottomOffset={24}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 32,
        gap: 20,
      }}
    >
      <ActionButton
        label="Back"
        icon="close"
        variant="ghost"
        disabled={busy}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/my-reports'))}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBadge name="lock" />
        <AppText variant="eyebrow" style={{ color: theme.accent }}>
          YOUR ACCOUNT
        </AppText>
      </View>
      <AppText variant="title">Keep your reports with you.</AppText>
      <AppText style={{ color: theme.muted }}>
        Save your reporting identity so you can recover private reports and site visits on another
        device. Your email is never shown on the public register.
      </AppText>
      {account?.accountReference && (
        <AppText variant="caption" selectable>
          Test account reference: {account.accountReference}
        </AppText>
      )}
      {!account && !error && <ActivityIndicator color={theme.accent} />}
      {error && (
        <AppText accessibilityRole="alert" style={{ color: theme.error }}>
          {error}
        </AppText>
      )}
      {notice && (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.accent }}>
          {notice}
        </AppText>
      )}
      {!account && error && (
        <ActionButton label="Retry account" icon="retry" onPress={() => void load()} />
      )}
      {account && !account.anonymous && mode !== 'reset' ? (
        <>
          <View style={{ padding: 20, borderRadius: 20, gap: 12, backgroundColor: theme.surface }}>
            <AppText variant="heading">Your identity is saved</AppText>
            <AppText>{account.email}</AppText>
            <AppText style={{ color: theme.muted }}>
              {account.emailVerified
                ? 'Email verified'
                : 'Verify this email to make sure you can receive recovery messages.'}
            </AppText>
          </View>
          {!account.emailVerified && (
            <ActionButton
              label="Send verification email"
              icon="send"
              busy={busy}
              onPress={() =>
                void run(async () => {
                  await verifyResidentEmail();
                  setNotice('Verification email requested. Open it, then refresh your account.');
                })
              }
            />
          )}
          <ActionButton
            label="Refresh account"
            icon="retry"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                setAccount(await refreshResidentAccount());
              })
            }
          />
          <ActionButton
            label="Reset my password"
            icon="lock"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setEmail(account.email ?? '');
              setMode('reset');
              setNotice(null);
              setError(null);
            }}
          />
          <ActionButton
            label="View my reports"
            icon="drafts"
            disabled={busy}
            onPress={() => router.replace('/my-reports')}
          />
        </>
      ) : account ? (
        <>
          <AppText variant="heading">
            {mode === 'save'
              ? 'Save this reporting identity'
              : mode === 'signin'
                ? 'Sign in to a saved identity'
                : 'Recover your account'}
          </AppText>
          <FormField
            label="Email address"
            icon="send"
            hint="Used only for signing in and account recovery."
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!busy}
            value={email}
            onChangeText={setEmail}
          />
          {mode !== 'reset' && (
            <FormField
              label="Password"
              icon="lock"
              hint={
                mode === 'save'
                  ? 'Use at least 12 characters.'
                  : 'Use the password for your saved account.'
              }
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'save' ? 'new-password' : 'current-password'}
              editable={!busy}
              value={password}
              onChangeText={setPassword}
            />
          )}
          {mode === 'save' && (
            <FormField
              label="Confirm password"
              icon="lock"
              hint="Enter the same password again."
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              editable={!busy}
              value={confirmation}
              onChangeText={setConfirmation}
            />
          )}
          <ActionButton
            label={
              mode === 'save'
                ? 'Save my reporting identity'
                : mode === 'signin'
                  ? 'Sign in'
                  : 'Request password reset'
            }
            icon={mode === 'reset' ? 'send' : 'lock'}
            busy={busy}
            onPress={() => void submit()}
          />
          {mode === 'save' ? (
            <ActionButton
              label="I already have an account"
              icon="arrow"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setMode('signin');
                setPassword('');
                setConfirmation('');
                setError(null);
                setNotice(null);
              }}
            />
          ) : (
            <ActionButton
              label={account.anonymous ? 'Save this device identity instead' : 'Back to my account'}
              icon="arrow"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setMode('save');
                setPassword('');
                setError(null);
                setNotice(null);
              }}
            />
          )}
          {mode === 'signin' && (
            <>
              <AppText variant="caption" style={{ color: theme.muted }}>
                Sign-in does not merge identities. If this device has reports or drafts, save its
                current identity first.
              </AppText>
              <ActionButton
                label="Forgot password"
                icon="retry"
                variant="ghost"
                disabled={busy}
                onPress={() => setMode('reset')}
              />
            </>
          )}
        </>
      ) : null}
      <AppText variant="caption" style={{ color: theme.muted }}>
        Submitted reports follow your saved account. Unsent drafts and camera evidence remain on
        their original device.
      </AppText>
    </KeyboardAwareScrollView>
  );
}
