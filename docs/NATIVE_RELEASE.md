# Native release checkpoint - updated 21 November 2026

These are private acceptance builds. Build/Android device evidence is from 13 November; Firebase APNs and Apple internal TestFlight availability were verified on 19 November. Physical iPhone acceptance and public App Store release remain open.

## Built and verified

- Signed ARM64 Android release: `.local/Civic263.apk`, package `co.zw.civic263.mobile`.
- Installed side-by-side acceptance APK: `.local/Civic263-acceptance.apk`, package `co.zw.civic263.mobile.acceptance`, launcher name **Civic263 Test**. The existing debug app and Expo Go data were not uninstalled or cleared.
- The acceptance APK cold-started on the Note9 without a Metro USB forward. Its embedded JavaScript contains no development App Check credential. Android package verification confirms the release certificate and a non-debuggable build.
- Native Play Integrity attestation reached the live backend: callable verification logs reported both `app: VALID` and `auth: VALID`. The private, server-authorized field-test controls loaded successfully.
- A signed iOS archive completed for bundle `co.zw.civic263.mobile`, version `0.1.0`, build `4`, Apple team `25L4M5VTCR`. Inspection of the executable's signed entitlements confirmed production App Attest, production APNs, the intended team/application identifier and disabled debugging. Firebase configuration, bundled JavaScript, camera/location purpose strings and background-location mode were present. The archive also includes the standard HTTPS encryption declaration for TestFlight. The exact [EAS build](https://expo.dev/accounts/mpumelelo_dube/projects/civic263/builds/e56d9403-d87d-4869-a93b-ef039f6dd9e2) was validated by Apple and activated for internal TestFlight testing on 19 November. The owner confirmed installing and opening it on 19 November; native functional checks remain open.
- Email/password sign-in and email enumeration protection are enabled in Firebase. Emulator tests covered linking without changing ownership, recovery from a separate client, password reset, failed credentials, duplicate email, and foreign-owner denial. No real recovery emails were sent by the tests.
- Community integration covered iOS/Android token registration, APNs payloads, token-account rebinding, private evidence and independent confirmation. The controller test rejects missing, expired, mistyped and non-QA field-test grants.
- Latest `npm run verify` passed on 21 November with 52 tests, workspace types/lint/builds and the offline Expo dependency check. This includes six owner-link and nine draft-recovery regression checks. The earlier recovery, community, field-access and cleanup checks passed separately.

The main Android artifact is not installed over the existing debug package because their signing certificates differ. Its strict App Check policy expects Play-recognized distribution. The separate acceptance app permits off-Play versions while requiring device integrity; the main app's recognition policy was not weakened.

## iPad acceptance - 19 November 2026

The owner clarified that the test device is an **iPad Pro M2 running iPadOS 26**, rather than an iPhone. Build 4 installed and opened on that device. The supplied resident identity was matched without changing its claims. Its existing user-confirmed test report has one photo and remains held/private with review reason `irrelevant`; no public incident was created by these checks.

Sanitized live callable records show Auth and App Check `VALID`, with HTTP 200 for owner report/photo retrieval. The owner confirmed the private photo opens in the app. Original image bytes were not inspected by the agent: automatic approval review rejected that download, and the separate operator metadata request returned Storage HTTP 403. The successful on-device owner preview is the photo-display evidence; no independent pixel/EXIF inspection is claimed.

The owner enabled push updates, and one iOS device registration was matched to that resident. A single explicitly labelled technical notification was accepted by FCM. The owner confirmed it arrived while Civic263 was backgrounded and tapping it reopened the app. This checks the real APNs/FCM/native delivery path, separately from the existing backend workflow integration tests. The message carried no report link; opening a specific report remains a separate check.

The owner also confirmed that both the app and map follow light/dark mode, the current-location pin is correct, camera/gallery attachments work and the app enforces the three-photo maximum in an unsent draft. These are user-observed build-4 checks; the draft was not submitted. Only the iPad is available today, so physical iPhone screen/hardware coverage is deferred and unverified.

The public register currently has no published incidents, and build 4 routes notification links to the public view. Source fix `8e1fb00` adds an owner lookup only after a public HTTP 404, preserving server ownership enforcement. Public success, foreign-owner denial, service failure and cancellation have regression coverage. [Build 5](https://expo.dev/accounts/mpumelelo_dube/projects/civic263/builds/5f71da3c-0dac-4cd5-88cc-1d8285887e7f) finished from that exact commit; archive inspection confirmed version 0.1.0 (5), production App Attest/APNs, correct team/bundle, bundled JavaScript and disabled debugging. Its [private submission](https://expo.dev/accounts/mpumelelo_dube/projects/civic263/submissions/b130f3f8-72c2-4c9d-b554-17242c66bef5) finished, and Apple's API reports it VALID, unexpired and internally IN_BETA_TESTING for app `6836809635`, linked to that exact build/submission. The owner subsequently confirmed build-5 installation and retained report ownership, but a saved-photo draft warning requires the recovery check below. The report-link retest remains open.

## Draft update recovery - 21 November 2026

The owner confirmed build 5 installed and the submitted report remained visible. The saved photo draft instead showed the preserved-files warning. The old reader required each absolute photo URI to start with the current Documents URI; [Apple documents that an update changes the app container's absolute path](https://developer.apple.com/library/archive/technotes/tn2285/). This is a matching source defect, not independent inspection of the iPad's private files.

Source fix `8c428f7` restores only the exact generated `civic263-photos/<photo UUID>.jpg` path under the current Documents directory. It accepts known older iOS container paths and writes relative paths on the next explicit save. Reading does not overwrite/delete old JSON or photos. Report and resolution drafts share the correction, with text, capture metadata, receipts and pending-send state retained. Unsafe paths and invalid drafts remain rejected. Nine regression tests passed within the 52-test verification.

[Build 6](https://expo.dev/accounts/mpumelelo_dube/projects/civic263/builds/7c276e2d-186d-4988-b701-ea809f2adf41) was requested from exact source `8c428f73a852b745ed6315778885381fbd2ed7fc` using the same private TestFlight profile and existing approved credentials. [Submission](https://expo.dev/accounts/mpumelelo_dube/projects/civic263/submissions/daf68990-cdfb-47ff-b089-9c9b11002577) is scheduled. Build/Apple processing and actual iPad draft/photo recovery and notification-to-report navigation remain unverified.

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

The user approved reusing APNs key `8LFLW7W3U9`, team `25L4M5VTCR`, including its existing use by `263-gaming`. It is assigned to Civic263 in EAS. Apple rejected creating another team-scoped key because its limit was reached. No existing key was revoked. On 19 November, the existing key was downloaded through Civic263's official Expo credential page and uploaded to the correct Firebase iOS client's production APNs slot. The saved key/team persisted after a console reload. The development slot remains unconfigured; build 4 uses production APNs. The private key is ignored and access-restricted, with no private material written to source/logs. Actual iPhone delivery remains R03.

App Store Connect app ID `6836809635` is recorded in the `testflight` submit profile. The user separately approved reusing existing API key `GR74QN3BR3` (EAS), which is now assigned to Civic263. The refreshed Apple session prepared the app and internal `Team (Expo)` group with access for the owner's account only; the user confirmed the iPhone uses that same Apple account. [EAS submission `d102ea16-59e6-4305-b2d1-9a7dd6fb2488`](https://expo.dev/accounts/mpumelelo_dube/projects/civic263/submissions/d102ea16-59e6-4305-b2d1-9a7dd6fb2488) finished successfully. Apple's API reports version 0.1.0 build 4 as `VALID`, internally `IN_BETA_TESTING`, unexpired and linked to that exact EAS archive/submission. The group automatically receives builds. External state is `READY_FOR_BETA_SUBMISSION`; no external beta review or public release was requested. The owner confirmed installation/startup; actual iPhone behavior remains R03.

## Private field test

The acceptance build has a clearly labelled private geofence screen. A fresh, explicitly approved Note9 account has a two-hour server claim; the isolation marker also prevents it from modifying genuine reports. No staff or administrator permission is granted.

Starting a test requires precise GPS and background-location permission. It creates a two-hour private 200 m region, never a report or public incident. The server records ordered exit, return and notification acknowledgements. Actual OS geofence callbacks advance the test; movement is not simulated. A route history is not stored. Technical expiry policies are active for the private test and the five daily quota collections.

On the Note9, precise/background grants and the foreground location service were verified. The user deferred the physical walk. At the last handoff the test/service was active; a successful pause was not verified. Check current device state and time-limited access before another test. The private stop helper still needs local-first failure handling so an offline/expired request cannot block pausing; ordinary Community preference pausing already persists locally. A physical crossing and termination/battery acceptance remain open. Android force-stop disables work until manual reopen; the app cannot bypass this OS behavior.

Account recovery links Firebase credentials to the existing resident UID. Sign-in refuses to abandon reports, visits, drafts or unsent evidence. Before a permitted account change it pauses old background/push state, unregisters the device and resets private views. Unsent photos/drafts remain local to their original device.

## Upload cleanup and remaining release gates

`python scripts/cleanup-abandoned-visit-uploads.py` is an admin-only dry run. `--self-test` checks its exclusions. `--apply` removes only superseded upload leases older than seven days for an already committed community visit, after rechecking retained paths and using a Storage generation precondition. It preserves every retained original, public derivative, uncommitted attempt and ambiguous initial submission. The live dry run found no eligible objects and deleted nothing. No broader runtime Storage permission was added.

Public rollout still needs build-6 iPad draft recovery and report-link retests, deferred physical iPhone coverage, geofence/termination acceptance, account deletion/lifecycle and the existing operational/privacy/pilot gates. Internal TestFlight processing/tester access for builds 4/5 is verified; App Store publication was not performed.

Firebase production APNs configuration and internal TestFlight delivery are complete. Available-device acceptance is in progress on the iPad, with physical iPhone coverage deferred. Use the [delivery plan](../tasks/plan.md) and [tracker](../tasks/todo.md) for the next actions. Implementation checkpoint `ece8053` preserves the earlier source/configuration after working-tree builds; build 5 records the exact owner-link source commit `8e1fb00`. Private artifacts and signing/configuration files remain ignored.

Dependency audit reported 25 findings (4 high, 20 moderate, 1 low; no critical). The high chain is the Firebase Node Firestore gRPC dependency. The [upstream certificate advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j) affects server-side certificate authentication; Civic263 runs no gRPC server. This reachability assessment does not mark the packages patched. Remaining advisories need a compatible SDK/dependency update review before public rollout; no forced downgrade or SDK change was applied.
