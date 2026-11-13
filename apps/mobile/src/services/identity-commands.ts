import {
  EmailAuthProvider,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';

export function residentEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Enter a valid email address.');
  return email;
}
export async function linkResidentIdentity(auth: Auth, email: string, password: string) {
  const user = auth.currentUser;
  if (!user?.isAnonymous)
    throw new Error('This identity already has a sign-in method. Refresh your account.');
  if (password.length < 12 || password.length > 4096)
    throw new Error('Use a password with at least 12 characters.');
  const result = await linkWithCredential(
    user,
    EmailAuthProvider.credential(residentEmail(email), password),
  );
  if (result.user.uid !== user.uid)
    throw new Error('The account changed unexpectedly. Refresh before continuing.');
  await result.user.getIdToken(true);
  return result.user;
}
export async function restoreResidentIdentity(
  auth: Auth,
  email: string,
  password: string,
  hasUnsavedIdentity: boolean,
) {
  if (!auth.currentUser?.isAnonymous || hasUnsavedIdentity)
    throw new Error(
      'Save this device identity with an email first. Its reports and drafts cannot be merged automatically.',
    );
  if (!password || password.length > 4096) throw new Error('Enter your account password.');
  return (await signInWithEmailAndPassword(auth, residentEmail(email), password)).user;
}
export async function requestResidentPasswordReset(auth: Auth, email: string) {
  try {
    await sendPasswordResetEmail(auth, residentEmail(email));
  } catch (error) {
    if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error;
  }
}
export function identityError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (
    [
      'auth/invalid-credential',
      'auth/wrong-password',
      'auth/user-not-found',
      'auth/invalid-login-credentials',
    ].includes(code ?? '')
  )
    return 'Could not sign in. Check your email and password, or request a reset.';
  if (['auth/email-already-in-use', 'auth/credential-already-in-use'].includes(code ?? ''))
    return 'That email already belongs to an account. Use another email to save this device identity; accounts are never merged automatically.';
  if (code === 'auth/network-request-failed')
    return 'Could not connect. Your existing identity and reports are safe. Retry when connected.';
  if (code === 'auth/too-many-requests')
    return 'Too many attempts. Wait a few minutes before retrying.';
  if (code === 'auth/operation-not-allowed')
    return 'Email sign-in is temporarily unavailable. Your current reports are safe.';
  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements')
    return 'Choose a stronger password with at least 12 characters.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  return error instanceof Error && !code
    ? error.message
    : 'Could not finish this account action. Your current reports are safe; retry.';
}
