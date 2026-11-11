# Scaffold handoff

## Ready in this scaffold

- npm workspaces with public web, ops web, Expo resident app, shared domain/browser packages and Firebase Functions.
- A public demonstration register with fictional records, filters, safe sample CSV and incident detail routing.
- Resident category/details form that saves drafts to device-local Expo File System storage and restores them in My reports.
- Ops shell with private access held closed until real staff Auth and scope checks are implemented.
- Firebase emulators, initial indexes, restrictive Firestore/Storage rules and a health function.
- Shared publication/validation tests, TypeScript, ESLint, production build commands and CI.

## Next implementation gates

1. Initialize the confirmed-empty GitHub repository, then publish implementation work on a feature branch without rewriting history. The scaffold is currently local.
2. Configure dev/staging/prod Firebase projects, regions, billing and named operators.
3. Prove native anonymous identity restoration, App Check and private media on real devices in development/store test builds.
4. Implement idempotent report intake, upload tickets and persistent submission outbox. Drafts must not be relabelled as received reports before server acknowledgement.
5. Implement named staff Auth, municipality membership checks and commands; then moderation, canonical incidents and publication.
6. Connect public bounded geo/data APIs and Google Maps; remove fictional records from production data paths.
7. Implement evidence timestamps, public snapshots, privacy deletion, notifications and release checks.

The public design baseline is Achromatic ledger (seed 879817), with neutral chrome, one teal data hue, a linked register/map, evidence age and a separate handoff label. Harare sample areas are illustrative and do not commit the pilot location. Data marked demo is never proof of live reports or council activity.

## Validation of this scaffold

`npm run verify` passed on Node 22.22.3: scaffold configuration, five domain tests, all six workspace type checks, ESLint, production builds for public web/ops/Functions, and the offline Expo SDK dependency check.

This Windows sandbox blocked npm from creating workspace links. Verification used ordinary local copies of the workspace packages and the authentic dependency archives recorded in the lockfile, with their integrity hashes checked. A normal clean `npm ci` still needs verification in an unrestricted development checkout or CI. The committed lockfile uses official npm registry URLs.

Browser visual checks, native device behavior, Firebase emulator/rules tests and cloud/store deployment have not been verified. No cloud reporting, staff access or public live-data integration is enabled.
