# Native release checkpoint - 13 November 2026

These are private acceptance builds. A completed EAS archive is not an App Store or TestFlight release.

## Built and verified

- Signed ARM64 Android release: `.local/Civic263.apk`, package `co.zw.civic263.mobile`.
- Installed side-by-side acceptance APK: `.local/Civic263-acceptance.apk`, package `co.zw.civic263.mobile.acceptance`, launcher name **Civic263 Test**. The existing debug app and Expo Go data were not uninstalled or cleared.
- The acceptance APK cold-started on the Note9 without a Metro USB forward. Its embedded JavaScript contains no development App Check credential. Android package verification confirms the release certificate and a non-debuggable build.
- Native Play Integrity attestation reached the live backend: callable verification logs reported both `app: VALID` and `auth: VALID`. The private, server-authorized field-test controls loaded successfully.
- A signed iOS archive completed for bundle `co.zw.civic263.mobile`, version `0.1.0`, build `3`, Apple team `25L4M5VTCR`. Inspection of the executable's signed entitlements confirmed production App Attest, production APNs, the intended team/application identifier and disabled debugging. Firebase configuration, bundled JavaScript, camera/location purpose strings and background-location mode were present. The archive also includes the standard HTTPS encryption declaration for TestFlight.
- Email/password sign-in and email enumeration protection are enabled in Firebase. Emulator tests covered linking without changing ownership, recovery from a separate client, password reset, failed credentials, duplicate email, and foreign-owner denial. No real recovery emails were sent by the tests.
- Community integration covered iOS/Android token registration, APNs payloads, token-account rebinding, private evidence and independent confirmation. The controller test rejects missing, expired, mistyped and non-QA field-test grants.
- `npm run verify` passed with 37 tests, workspace types/lint/builds and the offline Expo dependency check. The additional recovery, community, field-access and cleanup checks passed separately.

The main Android artifact is not installed over the existing debug package because their signing certificates differ. Its strict App Check policy expects Play-recognized distribution. The separate acceptance app permits off-Play versions while requiring device integrity; the main app's recognition policy was not weakened.

## Configuration and credentials

EAS project: `@mpumelelo_dube/civic263`, ID `fd226fa0-a289-44ce-9781-11537012ee9b`. Firebase project: `civic263-df6ec`.

| Firebase native client | App ID                                          |
| ---------------------- | ----------------------------------------------- |
| Android main           | `1:792490461250:android:a6fbd343d11fc61c0785db` |
| Android acceptance     | `1:792490461250:android:51d7b6e976fb31050785db` |
| iOS                    | `1:792490461250:ios:3c626b6b7cebf0dc0785db`     |

The local Expo module uses Play Integrity on Android and App Attest on iOS. It also converts the APNs device token into an FCM registration on iOS. Release JavaScript uses the native App Check provider and fails closed when it is unavailable. Debug attestation is development-only. Tokens remain in memory and are not logged.

The existing Maps credential is reused, as requested. Android embeds it in native configuration; iOS uses the platform map provider. Places remains a Zimbabwe-restricted server lookup. No additional Maps key was created.

The Android signing certificate SHA-256 is `F772D2E6EAE6DD343C29D4339CBA2DF630C9E84306C4FAEB6A449E7ABC28EE43`. The private keystore and credentials are backed up in Secret Manager as `CIVIC263_ANDROID_RELEASE_KEYSTORE` and `CIVIC263_ANDROID_RELEASE_CREDENTIALS`. Local copies are ignored and restricted to the current Windows user and SYSTEM. Runtime service accounts were not given signing-secret access.

EAS production has the public Firebase client settings and encrypted `GOOGLE_SERVICES_PLIST` file. Copying the Android Maps credential/client file to EAS was rejected by automatic approval review because that destination was not explicitly approved. Android releases were completed locally. A cloud Android build still needs that separate configuration; do not assume the current production profile alone supplies it.

The user approved reusing APNs key `8LFLW7W3U9`, team `25L4M5VTCR`, including its existing use by `263-gaming`. It is assigned to Civic263 in EAS. Apple rejected creating another team-scoped key because its limit was reached. No existing key was revoked. The Firebase upload and an actual iPhone delivery check remain separate acceptance steps.

## Private field test

The acceptance build has a clearly labelled private geofence screen. A fresh, explicitly approved Note9 account has a two-hour server claim; the isolation marker also prevents it from modifying genuine reports. No staff or administrator permission is granted.

Starting a test requires precise GPS and background-location permission. It creates a two-hour private 200 m region, never a report or public incident. The server records ordered exit, return and notification acknowledgements. Actual OS geofence callbacks advance the test; movement is not simulated. A route history is not stored. Technical expiry policies are active for the private test and the five daily quota collections.

On the Note9, precise/background grants and the foreground location service were verified. A physical crossing and termination/battery acceptance still require observation. Android force-stop disables background work until the app is opened again. Do not claim the app can bypass this OS behavior.

Account recovery links Firebase credentials to the existing resident UID. Sign-in refuses to abandon reports, visits, drafts or unsent evidence. Before a permitted account change it pauses old background/push state, unregisters the device and resets private views. Unsent photos/drafts remain local to their original device.

## Upload cleanup and remaining release gates

`python scripts/cleanup-abandoned-visit-uploads.py` is an admin-only dry run. `--self-test` checks its exclusions. `--apply` removes only superseded upload leases older than seven days for an already committed community visit, after rechecking retained paths and using a Storage generation precondition. It preserves every retained original, public derivative, uncommitted attempt and ambiguous initial submission. The live dry run found no eligible objects and deleted nothing. No broader runtime Storage permission was added.

Public rollout still needs physical geofence/termination acceptance, iPhone installation/App Attest/push acceptance, TestFlight processing/tester access, account deletion/lifecycle, and the existing operational/privacy/pilot gates. App Store publication was not performed.

Dependency audit reported 25 findings (4 high, 20 moderate, 1 low; no critical). The high chain is the Firebase Node Firestore gRPC dependency. The [upstream certificate advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j) affects server-side certificate authentication; Civic263 runs no gRPC server. This reachability assessment does not mark the packages patched. Remaining advisories need a compatible SDK/dependency update review before public rollout; no forced downgrade or SDK change was applied.
