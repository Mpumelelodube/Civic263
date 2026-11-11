# Configuration

## Public and operations web

Copy apps/web/.env.example and apps/ops/.env.example into their respective .env.local files. Firebase browser configuration is public client configuration, not server authorization. Restrict Maps browser keys by referrer/API. A public API base URL will be used when live data integration is implemented; the starter register deliberately uses fictional local fixtures.

## Resident app

Copy apps/mobile/.env.example to apps/mobile/.env. SDK 58 requires React Native 0.88 and React 19.3.0. Use `npx expo install` for native dependencies and run the dependency check after changes. The scaffold needs no location/camera permission or cloud key just to start or save a local draft.

Native Firebase files, Android signing identities, iOS bundle IDs, APNs/FCM and Maps provider setup are subsequent configuration tasks. The provisional identifiers `co.zw.civic263.mobile` and scheme `civic263` must be confirmed before store registration. No EAS project ID or store credential is invented here.

## Firebase

The default alias is the demo project, which cannot target a real cloud project. To configure a real project, add explicit development/staging/production aliases and review the region, Storage bucket, rules and billing settings. Configure each Hosting target with Firebase CLI before deployment. There is no deployment workflow in this scaffold.

Keep service accounts out of the repository. Server secrets belong in Secret Manager. Use emulators and restrictive rules while authorization and intake are being built.

Firebase client dependencies are pinned to the Node 22-compatible 12.x line. The root and independently deployed Functions package also pin the Firebase app peers to compatible versions; review those pins together when upgrading Firebase.
