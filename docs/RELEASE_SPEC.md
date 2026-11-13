# Release readiness - 13 November 2026

Approved scope: complete the remaining Android/iOS build, native attestation, recoverable identity and background-device acceptance. Apple team: 25L4M5VTCR. Expo owner: mpumelelo_dube. Reuse the existing Maps credential; never create another Maps key.

1. Add a local Expo native Firebase bridge: Play Integrity on Android, App Attest on iOS, and APNs-to-FCM token registration on iOS. Release builds must fail closed if native attestation is unavailable; development debug attestation remains explicitly development-only.
2. Add email/password account linking and recovery using Firebase Auth. Linking preserves the current UID and all private report/visit ownership. Failed sign-in/linking preserves the current session. Do not silently merge or abandon anonymous reports; do not expose email in public records. Passwords never enter application storage or logs.
3. Build a signed self-contained Android APK with bundled JavaScript/assets. Preserve the installed debug app and its private identity during release acceptance. Register the signing certificate and use native attestation, without embedding an App Check debug credential.
4. Prepare Apple-team signing, App Attest entitlement, iOS client configuration and APNs/FCM. Use the existing Expo account; no store publication or paid-plan purchase is implied. Verify actual build/install and notification state rather than reporting a queued build as completion.
5. Test notification opt-in/pause, native background registration, real geofence crossing and process/battery recovery as device availability permits. Simulated movement is labelled as simulation. A physical walk requires the user's participation and follows a ready installed build.
6. Apply technical daily-quota expiry and safe orphan-upload cleanup without deleting retained evidence or ambiguous submissions. Run repository verification, isolated ownership/recovery tests, release bundle checks and configured device checks.

Trust boundaries: Firebase Auth owns private email/password; the JS auth session remains in SecureStore. Native SDK attestation tokens are passed only to Firebase App Check in memory. Account switching must stop old reminder/push state and reset private in-memory views. A second account is not proof of a second human. Real report content is never changed for tests.
