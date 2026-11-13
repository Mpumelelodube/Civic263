# Private report intake

The mobile form supports up to three optional photos per submission. Reports can be submitted without photos. Camera/library images are resized to a maximum 1600 px side, converted to JPEG and compressed to at most 400 KiB each before sending. Compressed copies persist in the app's document directory. Original images are not uploaded.

`submitReport` is an authenticated callable command in `europe-west1`. The server validates an explicit input allowlist, decodes and re-encodes every JPEG to remove embedded metadata, and stores media privately. Firestore and Storage client writes remain denied. Reports start with pending moderation, hidden publication, received workflow and no municipal handoff.

The device saves a draft before sending. Its UUID and unchanged payload identify retries, including retries after a lost response. The server uses an owner-scoped reservation, a processing lease and a persistent daily quota of ten new submissions per identity. Only a committed server receipt produces a received state. Emulator receipts explicitly say test only. Invalid photo rejections allow correction; uncertain delivery keeps the payload unchanged for retry.

## Local integration test

Run from the repository root:

```powershell
npm run build --workspace @civic263/functions
npx --yes firebase-tools@14.20.0 emulators:start --project demo-civic263 --only auth,firestore,storage
# In another terminal:
npm run test:intake -- --http-handler
```

The fallback serves the built callable SDK HTTP handler with the SDK's Express dependency, using the real Auth, Firestore and Storage emulators. CLI 14's Functions emulator cannot load Functions SDK 7 because it calls the removed config API. `npm run emulators` now targets CLI 15.35.0 and requires Java 21; that full Functions-emulator run remains unverified because CLI downloads timed out during this session. `test:intake` without the fallback expects a Functions emulator on port 5001.

For a physical Android preview, run `node scripts/intake-test-server.mjs`, reverse ports 5001 and 9099 with ADB, and temporarily set `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=127.0.0.1` and `EXPO_PUBLIC_REPORT_INTAKE_ENABLED=true` in the ignored mobile environment file. Restart Metro and the app after changing environment settings. The helper is hard-coded to localhost/demo services. Emulator and live identities use different Firebase app names.

## Live integration update - 11 November 2026

The live project, private bucket, database rules, anonymous Auth and App Check-protected commands are now provisioned and deployed. The registered local Expo Go preview uses a development-only App Check token; store builds still require native attestation. Owner history and details, automatic publication and public photo viewing are implemented. See [Firebase backend](FIREBASE_BACKEND.md) for current setup, access gates and live/emulator test commands.

### Earlier launch checklist (historical)

The supplied `civic263-df6ec` browser configuration is in ignored local environment files for web, ops and mobile. Public web client initialization is wired; Analytics collection is not enabled. No live project resources or rules were changed. Project API checks timed out, so project provisioning, billing, database/bucket availability and Auth settings remain unverified.

Before enabling live sending: verify project access and provisioning; configure resident identity and a native App Check provider in a development/store build; deploy the command; then verify upload/receipt and identity restoration on that build. Production enforces App Check, which Expo Go cannot provide. Keep the intake flag false until those checks pass. Set retention/cleanup for abandoned private uploads and submission/quota records before public launch; a process termination during upload may leave private objects until retry or cleanup.

Staff review, moderation, incident publication, municipal handoff and cloud report history are separate pending work. A private platform receipt is not municipal acknowledgement.
