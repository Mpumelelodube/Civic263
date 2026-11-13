# Configuration

## Public and operations web

Copy apps/web/.env.example and apps/ops/.env.example into their respective .env.local files. Firebase browser configuration is public client configuration, not server authorization. The portal map currently uses OpenStreetMap and does not require a browser Maps key. The public register now reads the deployed public API. VITE_PUBLIC_API_URL can override its endpoint; fixture files are not used as live records.

## Resident app

Copy apps/mobile/.env.example to apps/mobile/.env. SDK 58 requires React Native 0.88 and React 19.3.0. Use `npx expo install` for native dependencies and run the dependency check after changes. Location and camera access are requested only for actions that need them; browsing and local drafts remain available without those grants.

The local previews use persisted Firebase anonymous identities and a registered development-only App Check token. The installed Android test app is registered in Firebase as `co.zw.civic263.mobile`, with scheme `civic263`. Its ignored `apps/mobile/google-services.json` configures FCM. Reviewer, nearby, background and push preferences are separate opt-ins under Reviews. Expo Go supports foreground previews; native background tasks and remote push require the installed app.

The user explicitly chose one existing Maps credential for all Google Maps/Places use. Native configuration reads `GOOGLE_MAPS_ANDROID_API_KEY` during prebuild; provide the existing Civic263 Secret Manager `GOOGLE_MAPS_SERVER_KEY` value in process memory for local prebuilds. Do not create another key or add the value to tracked source/logs. The ignored Android manifest contains the native client credential. Re-fetch it into the build environment before regenerating native projects; the server continues reading the same secret through its existing binding.

A private ARM64 debug APK has been built and tested on the Note9. It uses the local Metro server; it is not a self-contained store release. The EAS profiles are prepared but cloud EAS login/linking has not been verified. Store signing, production native attestation, recoverable sign-in and iOS/APNs remain release tasks. Never put the development App Check token in a store build.

## Firebase

The default alias is the demo project, which cannot target a real cloud project. To configure a real project, add explicit development/staging/production aliases and review the region, Storage bucket, rules and billing settings. Configure each Hosting target with Firebase CLI before deployment. The explicit live alias now points to civic263-df6ec. See FIREBASE_BACKEND.md for deployed resources, scoped permissions and test commands. No automated production deployment workflow is configured.

Keep service accounts out of the repository. Server secrets belong in Secret Manager. Use emulators and restrictive rules while authorization and intake are being built.

Firebase client dependencies are pinned to the Node 22-compatible 12.x line. The root and independently deployed Functions package also pin the Firebase app peers to compatible versions; review those pins together when upgrading Firebase.
