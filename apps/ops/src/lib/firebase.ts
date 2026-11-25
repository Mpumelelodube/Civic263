import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from 'firebase/functions';

let services: { auth: Auth; functions: Functions } | null | undefined;

/**
 * Operators sign in with a named email/password account. Signing in alone grants nothing:
 * every command is checked on the server against an active staffMembers record.
 */
export function getStaffServices() {
  if (services !== undefined) return services;
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = env.VITE_FIREBASE_APP_ID as string | undefined;
  if (!apiKey || !authDomain || !projectId || !appId) return (services = null);
  // Local development only: point the console at the demo emulators.
  const emulator = env.DEV ? (env.VITE_FIREBASE_EMULATOR_HOST as string | undefined) : undefined;
  const name = emulator ? 'civic263-ops-emulator' : 'civic263-ops';
  const app =
    getApps().find((item) => item.name === name) ??
    initializeApp(
      { apiKey, authDomain, projectId: emulator ? 'demo-civic263' : projectId, appId },
      name,
    );
  const auth = getAuth(app);
  const functions = getFunctions(app, 'europe-west1');
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
    connectFunctionsEmulator(functions, emulator, 5001);
  }
  return (services = { auth, functions });
}

export async function staffCall<T>(action: string, data: Record<string, unknown> = {}) {
  const current = getStaffServices();
  if (!current) throw new Error('The operations console is not configured.');
  return (
    await httpsCallable<Record<string, unknown>, T>(current.functions, 'staffCommand', {
      timeout: 60000,
    })({ action, ...data })
  ).data;
}

export function staffError(error: unknown) {
  const code = (error as { code?: string })?.code ?? '';
  if (code.endsWith('permission-denied'))
    return 'This account is not an active Civic263 operator, or its email is not verified.';
  if (code.endsWith('unauthenticated')) return 'Your session has ended. Sign in again.';
  if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials')
    return 'Could not sign in. Check your email and password.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes.';
  if (code.endsWith('unavailable') || code === 'auth/network-request-failed')
    return 'Could not reach Civic263. Check the connection and retry.';
  // The SDK reports blocked or failed network calls to the service as "internal".
  if (code === 'functions/internal')
    return 'The operations service did not respond. Retry; if it keeps failing, report it to the project owner.';
  return error instanceof Error && error.message ? error.message : 'Something went wrong. Retry.';
}
