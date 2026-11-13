import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export function getStaffAuth() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  const existing = getApps().find((app) => app.name === 'civic263-ops');
  return getAuth(
    existing ??
      initializeApp(
        {
          apiKey,
          authDomain,
          projectId,
          appId,
          storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ?? '',
          messagingSenderId:
            (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ?? '',
        },
        'civic263-ops',
      ),
  );
}

// Auth alone is insufficient for staff access. Add server-checked active
// municipality memberships/permissions before returning operational records.
