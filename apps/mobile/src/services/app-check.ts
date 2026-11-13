import { CustomProvider, initializeAppCheck } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';
import { nativeAppCheckToken } from './native-firebase';

export function configureResidentAppCheck(app: FirebaseApp) {
  // Trusted local testing only. Store builds must use native device attestation.
  const debugToken = __DEV__ ? process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN : undefined;
  if (!debugToken) {
    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: () => nativeAppCheckToken(app.options.projectId ?? ''),
      }),
      isTokenAutoRefreshEnabled: true,
    });
    return;
  }
  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: async () => {
        const response = await fetch(
          `https://firebaseappcheck.googleapis.com/v1/projects/${app.options.messagingSenderId}/apps/${app.options.appId}:exchangeDebugToken?key=${app.options.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ debugToken }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok)
          throw new Error('Could not verify this test build. Your drafts are safe.');
        const result: unknown = await response.json();
        if (
          !result ||
          typeof result !== 'object' ||
          !('token' in result) ||
          typeof result.token !== 'string' ||
          !('ttl' in result) ||
          typeof result.ttl !== 'string' ||
          !/^\d+(\.\d+)?s$/.test(result.ttl)
        )
          throw new Error('Build verification returned an invalid response.');
        return {
          token: result.token,
          expireTimeMillis: Date.now() + Number.parseFloat(result.ttl) * 1000,
        };
      },
    }),
    isTokenAutoRefreshEnabled: true,
  });
}
