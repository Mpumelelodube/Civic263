# Release readiness - 13 November 2026

Approved scope: complete the remaining Android/iOS build, native attestation, recoverable identity and background-device acceptance. Apple team: 25L4M5VTCR. Expo owner: mpumelelo_dube. Reuse the existing Maps credential; never create another Maps key.

1. Add a local Expo native Firebase bridge: Play Integrity on Android, App Attest on iOS, and APNs-to-FCM token registration on iOS. Release builds must fail closed if native attestation is unavailable; development debug attestation remains explicitly development-only.
2. Add email/password account linking and recovery using Firebase Auth. Linking preserves the current UID and all private report/visit ownership. Failed sign-in/linking preserves the current session. Do not silently merge or abandon anonymous reports; do not expose email in public records. Passwords never enter application storage or logs.
3. Build a signed self-contained Android APK with bundled JavaScript/assets. Preserve the installed debug app and its private identity during release acceptance. Register the signing certificate and use native attestation, without embedding an App Check debug credential.
4. Prepare Apple-team signing, App Attest entitlement, iOS client configuration and APNs/FCM. Use the existing Expo account; no store publication or paid-plan purchase is implied. Verify actual build/install and notification state rather than reporting a queued build as completion.
5. Test notification opt-in/pause, native background registration, real geofence crossing and process/battery recovery as device availability permits. Simulated movement is labelled as simulation. A physical walk requires the user's participation and follows a ready installed build.
6. Apply technical daily-quota expiry and safe orphan-upload cleanup without deleting retained evidence or ambiguous submissions. Run repository verification, isolated ownership/recovery tests, release bundle checks and configured device checks.

Trust boundaries: Firebase Auth owns private email/password; the JS auth session remains in SecureStore. Native SDK attestation tokens are passed only to Firebase App Check in memory. Account switching must stop old reminder/push state and reset private in-memory views. A second account is not proof of a second human. Real report content is never changed for tests.

## Progress against this scope - updated 21 November 2026

| Item                       | Recorded result                                                                                        | Remaining acceptance                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1. Native bridge           | Android integrity validated; iPad owner commands, photo/push, themes, GPS and photo controls passed    | Build-6 draft recovery and report-link retests; physical iPhone coverage deferred (R03).   |
| 2. Recovery                | Implemented, provider enabled, ownership/recovery emulator checks passed                               | Real-user setup and broader deletion/account lifecycle remain separate gates.              |
| 3. Android artifact        | Signed main/acceptance APKs built; side-by-side standalone acceptance and attestation passed           | Main recognized-distribution acceptance (R07).                                             |
| 4. Apple/iOS setup         | Production APNs verified; Apple validated builds 4 and 5 for internal TestFlight on 19 November        | Deliver build 6 and retest preserved drafts/report links (R03).                            |
| 5. Device/background tests | Native tasks/grants and earlier notification tests verified                                            | Reliable private-test stop, deferred walk and process/battery/revocation checks (R04-R06). |
| 6. Cleanup/checks          | Six technical TTL policies active; conservative cleanup self-test/dry run and repository checks passed | Broader retention/runbooks and compatible dependency security updates (R08, P01-P03).      |

The [delivery plan](../tasks/plan.md) and [task tracker](../tasks/todo.md) hold the ordered remaining work. Do not mark a device or distribution gate complete from a build result alone.
