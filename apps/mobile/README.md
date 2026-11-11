# Civic263 resident app

Run `npm run dev:mobile` from the repository root after `npm ci`.

Expo SDK 58 / React Native 0.88.1 / React 19.3.0. The source began from the official Expo default template; its 0BSD license is retained. Unused sample screens and artwork were removed. Add approved Civic263 icons before store submission.

The three starter routes are Nearby, Report an issue and My reports. The native form writes draft files in app storage on the device; it does not make live reports or notify authorities. Drafts restore when My reports gains focus.

No sign-in screen is present. Persisted native Firebase anonymous identity, report uploads/outbox, Google Maps, foreground permissions and push remain subsequent implementation work. Real Firebase native modules require a development build when added; the current starter uses Expo Go-compatible modules.

Use `npx expo install` inside this directory for new native dependencies and run `npm run check:mobile` from the root afterwards. Bundle/package IDs are provisional and no EAS/store project or credentials are configured.
