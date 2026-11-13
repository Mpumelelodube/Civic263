import { getApps, initializeApp } from 'firebase/app';

export function getPublicFirebaseApp() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return (
    getApps().find((app) => app.name === 'civic263-public') ??
    initializeApp(
      {
        apiKey,
        authDomain,
        projectId,
        appId,
        storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ?? '',
        messagingSenderId:
          (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ?? '',
        measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined) ?? '',
      },
      'civic263-public',
    )
  );
}

// Initializing the client does not grant data access or enable Analytics collection.
