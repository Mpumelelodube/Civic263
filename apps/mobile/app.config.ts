/// <reference types="node" />
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const acceptance = process.env.CIVIC263_BUILD_VARIANT === 'acceptance';
  const androidClient = acceptance ? './google-services.acceptance.json' : './google-services.json';
  return {
    ...config,
    name: acceptance ? 'Civic263 Test' : 'Civic263',
    slug: config.slug ?? 'civic263',
    extra: { ...config.extra, buildVariant: acceptance ? 'acceptance' : 'production' },
    ios: {
      ...config.ios,
      appleTeamId: '25L4M5VTCR',
      ...(process.env.GOOGLE_SERVICES_PLIST ||
      existsSync(join(__dirname, 'GoogleService-Info.plist'))
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist' }
        : {}),
      entitlements: {
        ...config.ios?.entitlements,
        'com.apple.developer.devicecheck.appattest-environment': 'production',
      },
      infoPlist: {
        ...config.ios?.infoPlist,
        FirebaseAppDelegateProxyEnabled: false,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...config.android,
      package: acceptance ? 'co.zw.civic263.mobile.acceptance' : 'co.zw.civic263.mobile',
      ...(process.env.GOOGLE_SERVICES_JSON || existsSync(join(__dirname, androidClient))
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? androidClient }
        : {}),
      ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY
        ? {
            config: {
              ...config.android?.config,
              googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY },
            },
          }
        : {}),
    },
  };
};
