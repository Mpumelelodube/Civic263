# Reporting acceptance checks - 12 November 2026

## On-site resolution acceptance � 12 November 2026

- `npm run verify`: 27 tests, workspace type checks, lint and builds passed; Expo dependency check ran offline.
- Demo integration: owner-only closure, at least one/at most three camera evidence items, decoded JPEGs, saved-pin proximity, stale/mocked/inaccurate fixes, stable aged retries, original-photo retention, public archive filtering, privacy holds and provider/quota failures passed. A late review lease cannot overwrite the winning derivative batch.
- Note9: genuine report was blocked at approximately 5.4 km and left unchanged. A labelled private fixture tested the real fused-provider GPS flow. The user prepared a non-sensitive scene; a new camera photo survived a cold app restart, then resolved only that demo fixture. The owner detail showed Resolved by you and its separate retained resolution gallery. Server checks observed 0 m reported distance, 20 m reported accuracy, a single event and a 67 KiB 777x1600 metadata-stripped JPEG. These are device-reported readings, not independent proof of physical presence.
- Browser: the isolated public archive loaded the original and the separately approved resolution photo with retained history. The live portal preview was restored afterward.
- Live: Auth/App Check, foreign-owner denial, private originals, camera evidence command, stable retries and test-identity isolation passed. The real resolution-purpose privacy provider contract held synthetic patterns without creating reports.
- Deployment: eight functions and public Hosting released. The exact internal invoker grant was explicitly approved and applied only to the existing backend service account on reviewresolution. Private Eventarc delivery succeeded (HTTP 204). Both review workers remain private.

Artifacts: `.local/resolution-native-result.json`, `.local/resolution-camera-gallery.jpg`, `.local/resolution-integration.log`, `.local/resolution-live-check.log` and `.local/resolution-verify.log`. Test receipts are labelled and never represent genuine public service reports.

The connected Samsung Note9 exercised the report flow using its current foreground location and three clearly labelled synthetic images. The device and local portal used only `demo-civic263` during this check. No synthetic report was added to the live public register.

## Results

| Check                                         | Result                                                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current location and reverse-geocoded address | Confirmed on the phone; the pin was explicitly accepted.                                                                                                                                          |
| Camera permission, launch and cancellation    | Returned to the same form without adding a photo.                                                                                                                                                 |
| Three-photo picker and cap                    | Three photos attached; further picker/camera actions disappeared at the cap.                                                                                                                      |
| Compression                                   | Original 2400 x 1800 test images became approximately 36-38 KiB each. Server copies stayed within 1600 pixels and 400 KiB, with EXIF removed.                                                     |
| Interrupted delivery                          | Disconnecting the demo API retained the report and all photos, with an unconfirmed-delivery state.                                                                                                |
| Cold restart and retry                        | Text, location and photos survived restart. Reconnecting and retrying created exactly one server report.                                                                                          |
| Owner history and private gallery             | The received report appeared first, refreshed its publication status, and displayed all three private server originals.                                                                           |
| Mobile photo viewer and navigation            | Private and public photos enlarged and closed; back navigation returned to the originating screens.                                                                                               |
| Demo publication and nearby map               | The same phone report received three public derivatives and an approximate position; its labelled pin appeared within 5 km of the current location.                                               |
| Public portal                                 | The same reference and all three approved images loaded in the browser; image dimensions were 1280 x 960.                                                                                         |
| Publication failure cases                     | Isolated integration checks passed for privacy holds, owner isolation, duplicate review events, test isolation and the five-attempt failure limit.                                                |
| Live backend                                  | Registered test App Check, Auth, zero-to-three-photo intake, idempotency, owner history/photos, cross-owner denial, denied direct writes/raw media and automatic synthetic-test isolation passed. |

## Fixes found during acceptance

- Interrupted callable delivery now shows a useful retry message instead of `internal [0]`.
- History merges prefer refreshed server status, retain older loaded reports, sort drafts and submissions together, and remove duplicate local receipt rows. Regression tests cover refreshed review state and combined ordering.
- Report details now lives in a native stack above the three main tabs. The installed SDK 58 router redirected the previous hidden-tab detail route to Nearby, preventing access to report photos. Existing public route paths remain the same.
- The loopback-only intake helper now serves the actual owner history, owner details and public API handlers as well as submission and Places.

## Limits

Demo approval used an explicit simulated decision to exercise publication and photo views with synthetic images. It does not demonstrate that a real issue passes the live Vision/model assessment. The live checks deliberately kept synthetic reports private. Native/store App Check, standalone Maps keys, iOS acceptance, identity recovery and operational release gates remain separate work.

The trusted live preview configuration is restored after testing. Synthetic local test receipts and their labelled source images remain identifiable as test data; they are not municipal reports or acknowledgements.


## Community review acceptance: 13 November 2026

- Two physical-Note9 app sandboxes supplied distinct demo identities: Expo Go proposed the fix, the installed `co.zw.civic263.mobile` app independently confirmed it. This establishes separate accounts, not separate humans. Both used newly captured user-prepared non-sensitive photos and device-reported 20 m GPS accuracy. Only the labelled emulator issue was changed.
- The server retained two private, EXIF-free JPEG originals (73,755 / 96,308 bytes, 777x1600), recorded both visits, archived the confirmed issue and delivered both events to the original reporter inbox. The native reviewer reopened their private visit photo. Demo-only camera photos were held private by the actual privacy worker's test-isolation policy.
- The public browser showed a pending fix as open, its retained map pin and history; after confirmation it refreshed to community-confirmed resolved with both visits. A separate synthetic integration fixture loaded its approved public visit image (80x60) successfully.
- Installed Android permissions accepted foreground and background location independently of reviewer opt-in. Movement and geofence tasks persisted; the location foreground service ran. An expired demo cache was refreshed for a separate labelled target, producing one local nearby reminder and updating the cooldown ledger. This was not a physical geofence-crossing test.
- One labelled private QA notification used the deployed backend sender and reached the backgrounded Note9 through FCM on its first attempt. No synthetic public report was created in the live project. The QA device token registration was removed afterward; labelled private audit records were retained.
- Acceptance caught and fixed permission-dependent cleanup blocking reviewer sign-up, stale action/queue/history state after visits, and portal refresh failing to reload an open issue detail. Pausing nearby reminders persists locally despite an unsuccessful server save; unrelated preference changes retain existing push registration.
- Windows native compilation required a temporary workspace drive alias and shortened local CMake staging paths. The native Maps key and Firebase client file remain in ignored generated configuration. Android debug APK installation and dark map tiles/service icon were observed after a cold restart.
- Final verification: 34 tests passed, all workspace checks/builds passed, both emulator integration suites passed, live backend isolation checks passed, final Hosting release completed. `git diff --check` passed. The SDK dependency check used offline mode.
- Remaining: physical walk/geofence entry/exit and battery/termination recovery; self-contained production Android build with native attestation; iOS/APNs/device testing; recoverable identity and operational media cleanup. Debug APK tests depend on the local Metro server.

Artifacts: `.local/community-native-result.json`, `.local/community-native-push-receipt.json`, `.local/community-complete-verify.log`, `.local/community-final-integration.log`, `.local/community-final-publication.log`, `.local/community-final-deploy.log`, `.local/community-pending-portal.png`, `.local/community-live-portal.png`, `.local/community-native-cold-map.png`. The live endpoint configuration and previews were restored; genuine records were unchanged.
