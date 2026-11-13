import { getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import {
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  signInAnonymously,
  type Persistence,
} from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';
import { secureAuthStorage } from './secure-auth-storage';
import { configureResidentAppCheck } from './app-check';

export const intakeEnabled = process.env.EXPO_PUBLIC_REPORT_INTAKE_ENABLED === 'true';
let services:
  { auth: ReturnType<typeof getAuth>; functions: ReturnType<typeof getFunctions> } | undefined;
let signingIn: Promise<unknown> | null = null;
export async function residentServices() {
  const current = getReportingServices();
  await current.auth.authStateReady();
  if (!current.auth.currentUser) {
    signingIn ??= signInAnonymously(current.auth).finally(() => {
      signingIn = null;
    });
    await signingIn;
  }
  return current;
}
export function getReportingServices() {
  if (services) return services;
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId)
    throw new Error('Firebase is not configured. Your draft is safe on this device.');
  const emulatorHost = __DEV__ ? process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST : undefined;
  const appName = emulatorHost ? 'civic263-resident-emulator' : 'civic263-resident';
  const existing = getApps().find((item) => item.name === appName);
  const app =
    existing ??
    initializeApp(
      {
        apiKey,
        authDomain,
        projectId: emulatorHost ? 'demo-civic263' : projectId,
        appId,
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      },
      appName,
    );
  // Metro selects Firebase's documented react-native export; its common .d.ts omits it.
  const nativeAuth = FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence(storage: typeof secureAuthStorage): Persistence;
  };
  const auth =
    existing || Platform.OS === 'web'
      ? getAuth(app)
      : initializeAuth(app, {
          persistence: nativeAuth.getReactNativePersistence(secureAuthStorage),
        });
  const functions = getFunctions(app, 'europe-west1');
  if (!existing && !emulatorHost) configureResidentAppCheck(app);
  if (emulatorHost) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFunctionsEmulator(functions, emulatorHost, 5001);
  }
  services = { auth, functions };
  return services;
}
