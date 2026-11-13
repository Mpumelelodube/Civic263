# Implementation status

## Current checkpoint: native release acceptance (13 November 2026)

Signed self-contained Android artifacts are built. Civic263 Test runs alongside the original Note9 app, cold-starts without Metro, and has passed live native App Check/Auth validation. Account linking/recovery is implemented and tested, and Firebase email/password recovery is enabled. The signed iOS archive has compiled successfully and its production App Attest/APNs entitlements were inspected. The approved APNs key is assigned in EAS; Firebase upload, TestFlight installation and real iPhone delivery still need acceptance.

The private Note9 geofence test is running with precise/background grants and a foreground location service. Its explicitly approved access expires after two hours; it creates no public issue. The actual outdoor crossing and process/battery behavior are not yet claimed as passed. All six technical TTL policies are active. The safe upload-cleanup dry run deleted nothing. Repository verification passed with 37 tests, plus separate recovery/community/field-access checks. See [native release details](NATIVE_RELEASE.md) for artifacts, configuration and remaining gates.

Earlier checkpoints below describe the state at their recorded milestone.

## Community review checkpoint (13 November 2026)

Community review is implemented and deployed. Any signed-in resident can report a fix to a published issue; a different opted-in reviewer can confirm or reject it from the mobile app. All visits require the current private-site location within 20 metres and 1-3 new camera photos. Pending fixes remain active; confirmation archives the issue and removes its active pin; rejection restores the previous active status. Public history and privacy-cleared derivatives remain separate from private originals and reviewer identities.

The new Reviews tab includes reviewer opt-in, nearby checks, a private inbox, private visit galleries, and separate nearby/background/push preferences. Nearby alerts use a 200 m invitation radius with 24-hour per-issue and three-per-day limits. Background movement/geofencing and FCM are configured in the installed Android test build. The existing Maps credential was reused as explicitly requested; no additional Maps key was created.

Verified on the physical Note9 using two separate demo accounts: a real camera fix report followed by a fresh independent camera confirmation; original reporter inbox updates; private reviewer gallery; native background permission, persisted movement/geofence tasks and foreground service; one delivered nearby reminder; and a live backend FCM push received while backgrounded. Both photos were 777x1600 JPEGs (73,755 and 96,308 bytes), with EXIF removed. The original genuine report was not modified. Browser checks confirmed pending/open state, confirmed archive history, and loaded privacy-approved synthetic derivatives. Demo endpoints were then removed and both previews restored to live data.

`npm run verify` passed with 34 tests, all workspace type checks, ESLint, public/ops/Functions production builds, and the offline SDK dependency check. Community and publication emulator integration suites passed, as did live backend identity/App Check/private-data isolation checks. Android ARM64 debug APK built and installed. Firebase indexes, existing functions and public Hosting are deployed; the approved sender role contains only `cloudmessaging.messages.create`, and both private review workers retain backend-service-account invocation.

Remaining release checks: a physical walk across geofence boundaries and battery/process termination recovery; a self-contained release build with production native attestation and recoverable resident identities; iOS/APNs configuration and device acceptance. The installed debug APK currently uses the local Metro server. Its live anonymous identity is separate from the earlier Expo Go identity; earlier reports remain in that Expo Go identity. Daily usage cleanup policies for the two new quota collections and orphan-upload retention should be included in operational release hardening. Earlier sections below are historical checkpoints, not the current feature status.

## On-site resolution update � 12 November 2026

Resolution now requires a fresh device GPS fix within 20 metres of the original private report pin, accuracy within 20 metres, and 1�3 newly captured camera photos. The app checks location before opening the camera, after capture and before sending; the server validates all submitted evidence before closing a report. Resolution photos are retained separately and private public-copy review runs asynchronously. Initial report photos remain optional (maximum three), while a confirmed report pin is now required for submission. Legacy resolutions remain readable.

Validation: `npm run verify` passed with 27 tests, workspace types, lint and builds (Expo dependency check offline). Demo intake and publication integration tests passed, including invalid/off-site/stale/mocked evidence, privacy failures, aged committed retries, review/resolution races and a late resolution-review worker. Note9 loaded the new sheet and correctly rejected a fresh off-site fix approximately 5.4 km from the genuine report pin, with confirmation disabled; no genuine report was closed. The user prepared the camera scene and the Note9 on-site test passed with a new in-app photo: its draft survived a cold restart, the command committed with a fresh fix at 0 m reported distance and 20 m reported accuracy, and the owner gallery loaded the retained resolution image. The stored JPEG was 67 KiB, 777 by 1600 pixels, with embedded metadata stripped. The isolated fixture originally used a GPS-provider anchor; after its first 23 m rejection, only that labelled demo fixture was corrected to the fused provider used by Expo. The product's 20 m limit was unchanged. A short foreground watch now waits up to 20 seconds for an accurate fix rather than failing on the first coarse reading. The eight-function backend and public Hosting deployment completed. Live synthetic-identity checks passed for Auth/App Check, owner isolation, 1�3 resolution evidence storage, stable receipts and retained originals. The private review worker is ACTIVE. The user approved its exact service-account-only invoker grant; it was applied and successful Eventarc delivery was observed (HTTP 204). Its IAM policy contains only the existing backend service account, with no public invoker binding. The portal test loaded both original and approved resolution galleries; the preview was restored to live data. The Note9 live profile was restored exactly, its demo-only tunnels removed, and the genuine reporting identity reloaded.

## Resident resolution - 12 November 2026

Civic263 is community led: residents raise reports and the original reporter can mark their submitted report resolved without staff approval. Owner confirmation records a server timestamp, preserves the report and photos, removes the active pin, and keeps previously public records in the portal's resolved archive and CSV exports. Public attribution reads Resolved by reporter; private or held reports remain private.

The lifecycle command uses the existing Auth/App Check-protected submitReport service. Its transaction is owner-only and idempotent, updates the canonical/public record together, and writes a private audit event. Review/resolution race tests prove queued or in-flight review cannot publish a resolved private report or restore a pin. No new HTTP invocation grant was needed.

The feature is deployed to the live backend and public portal. Note9 demo checks passed for active-pin visibility, cancel, failed confirmation, retry, retained photo, refreshed history and pin removal. Browser checks passed for the resolved archive, retained public photo/date and CSV resolution fields. Live checks passed using isolated synthetic identities; no genuine existing report was resolved. Backend security patches clear the audited high/critical findings; lower-severity SDK dependency findings remain recorded in [Firebase backend notes](FIREBASE_BACKEND.md).

## Acceptance update - 12 November 2026

The Note9-to-portal acceptance check passed against the isolated demo backend using the phone's current location and three labelled test images. It covered camera cancellation, compression, interrupted delivery, cold restart, a single successful retry receipt, private originals, public derivatives, fullscreen photo viewing and the nearby published pin. The live backend checks also passed with private test identities. Demo approval was simulated; no synthetic issue was published to the live register. See [acceptance checks](ACCEPTANCE_TESTING.md) for the evidence and remaining release gates.

Acceptance fixes address stale review status overwriting fresh results, new reports being buried under older drafts, unclear network errors and the SDK 58 hidden-tab redirect that prevented photo details from opening. The three main routes now live in a tab group, with details in the root stack. Places search is deployed with a Zimbabwe-only country restriction and has been checked on the Note9.

## Current backend update - 11 November 2026

Photo limit correction: photos are optional, with a maximum of three. The app and server enforce the same cap; compression is unchanged.

The live project is now provisioned: Firestore in europe-west1, a private Firebase Storage bucket with public access prevention, anonymous Auth, App Check-protected resident callables, a public incident/photo API, and an automatic Firestore review worker. Custom backend permissions are scoped to the default database and report photo paths. Maps credentials are server-only in Civic263 Secret Manager.

Mobile and public web now read backend records rather than fictional map/register fixtures. Mobile has owner report history, private photo details, public report/photo details and live nearby queries. The public portal has published records, approved photos, real approximate map positions and safe CSV exports. The public app retains the Achromatic ledger direction, seed 879817.

Live checks have confirmed App Check, Auth, a three-photo maximum, private upload, idempotent receipts, owner photo retrieval, cross-owner denial, direct-write/raw-media denial and automatic test isolation. Demo publication integration and the real Vision/model request contract also passed. All 19 repository tests, type checks, lint, builds and the Expo dependency check passed. The user explicitly approved the one-service owner-history HTTP invocation permission; it has been applied while preserving Firebase Auth, App Check and owner checks. Full live history, private photo retrieval, owner isolation and automatic test-isolation checks have passed. The public portal is deployed at https://civic263-df6ec.web.app. Live submission is enabled in the trusted local Note9 preview; the Note9 has been cold-reloaded and its live nearby, report-history and report-form screens have been checked. All full live backend checks passed; synthetic test reports remain private. Physical Note9 requests returned HTTP 200, live Places autocomplete/details opened the location map, and the report action footer was hidden during keyboard entry so suggestions remain selectable. The test query was cleared without submitting a report. See [Firebase backend](FIREBASE_BACKEND.md) for the workflow, test commands and release gates.

The previous scaffold and local-preview notes below are historical; this update supersedes their cloud-setup status.

---

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
4. Deploy and validate the implemented bounded-photo intake command and persistent draft/retry flow. Private uploads run through that command rather than separate upload tickets. Drafts must not be relabelled as received reports before server acknowledgement.
5. Implement named staff Auth, municipality membership checks and commands; then moderation, canonical incidents and publication.
6. Connect public bounded geo/data APIs and Google Maps; remove fictional records from production data paths.
7. Implement evidence timestamps, public snapshots, privacy deletion, notifications and release checks.

The public design baseline is Achromatic ledger (seed 879817), with neutral chrome, one teal data hue, a linked register/map, evidence age and a separate handoff label. Harare sample areas are illustrative and do not commit the pilot location. Data marked demo is never proof of live reports or council activity.

## Validation of this scaffold

`npm run verify` passed on Node 22.22.3: scaffold configuration, five domain tests, all six workspace type checks, ESLint, production builds for public web/ops/Functions, and the offline Expo SDK dependency check.

This Windows sandbox blocked npm from creating workspace links. Verification used ordinary local copies of the workspace packages and the authentic dependency archives recorded in the lockfile, with their integrity hashes checked. A normal clean `npm ci` still needs verification in an unrestricted development checkout or CI. The committed lockfile uses official npm registry URLs.

Browser visual checks, native device behavior, Firebase emulator/rules tests and cloud/store deployment have not been verified. No cloud reporting, staff access or public live-data integration is enabled.

## Follow-up: resilient local draft loading

My reports now loads readable drafts even when another saved file is invalid or unreadable. The screen reports how many drafts could not be read and offers retry; original files are preserved. Empty storage remains distinct from failed reads. Two automated tests cover mixed failures, all failures, empty storage and newest-first ordering. This remains device-local storage, with no server submission or municipal acknowledgement.

## Follow-up: map-first resident dashboard

Nearby now uses a native map with a 5 km search circle. Moving the map filters fictional geolocated examples around its new centre; pins and the nearby list open a native half/full-height bottom sheet with a draft-report shortcut. Foreground location is requested only through Use my location, with denied/unavailable states and manual map browsing retained. No background tracking or live incident queries are enabled. Harare is an illustrative starting point, not confirmed coverage.

Live viewport fetching, pagination/caching, approved incident details and server submission remain pending. Production map keys and native location permission configuration must be completed before development/store builds; Expo Go supplies the current test runtime.

### Note9 preview verification (11 November 2026)

Inspected physical SM-N960F screenshots after a full Expo Go restart. Confirmed the native map and fictional pins, nearby sheet with the map visible behind it, empty-area message, report shortcut opening the local draft form, and return navigation. Fixed an observed runtime text error by supplying native Button labels through the installed SDK 58 label prop, and kept the sheet host outside map layout to avoid shrinking the map. Full npm run verify passed after these fixes. This is a focused preview check, not a complete native acceptance test; offline persistence, permission-denial recovery and live reporting still need device validation.

## Follow-up: system light and dark appearance

The resident app follows device appearance through automatic Expo configuration and a shared useTheme hook. Native semantic colours cover screen backgrounds, text, borders and error states; teal accents adapt for contrast. Navigation, status bar, native buttons/inputs, the nearby sheet and map use the same current scheme. The Android map is recreated only when appearance changes because react-native-maps 1.29 applies its colour scheme at creation; the current region is reused.

Full npm run verify passed. Physical Note9 screenshots confirmed dark and light maps/sheets and the report form in both modes after changing Samsung Display settings; the original dark setting was restored. iOS and standalone-build splash behaviour remain unverified.

### Palette and tab navigation refinement

Replaced default black native surfaces with explicit paired Civic263 palettes: dark slate background #172637, blue-grey panels #23364a, navigation #1c2e42 and teal accent #78dbcf, with a coordinated light palette. Navigation theme, report field text/placeholders, cards and sheet share these tokens. Added map, report and document tab icons through the installed expo-symbols package (Material Symbols on Android and SF Symbols on iOS). Removed the scaffold's hidden-icon setting. Verified the icons and dark palette on the physical Note9. Palette contrast checks passed: minimum normal text contrast across surfaces is 5.36:1 in light mode and 7.20:1 in dark mode. iOS remains unverified.

## Follow-up: mobile typography and interaction polish

Bundled Public Sans regular, medium, semibold and bold with a shared type scale. Added semantic Material/SF icons throughout map actions, service choices, form labels, saved drafts and feedback. Shared buttons use 120 ms UI-thread press feedback; fields use 180 ms focus transitions with immediate typing, character counts and readiness checks. Keyboard-aware scrolling and a sticky save footer keep the action visible above the keyboard. Save/error haptics accompany visible feedback, and saved confirmation appears only for a real device-local draft. Tabs remain immediate rather than sliding between peer destinations.

The nearby and service sheets now use a React Native Modal surface with Reanimated/Gesture Handler half/full resting positions, scrollable content, drag/close controls and live reduced-motion preference handling. This replaces the Expo Go 58.0.5 Compose-hosted React Native touch boundary that failed during physical-device testing. Two motion regression tests cover slow-drag snap decisions and fast flicks.

Validation: npm run verify passed with ten tests, type checks, lint, web/ops/Functions builds and the offline Expo dependency check. Physical Note9 checks confirmed the typeface/icons, empty-save validation, both input fields, keyboard-following save action, a successful labelled fictional local test draft, saved confirmation, sheet expansion, scrolling and category selection. A reduced-motion open/close test passed and the original animation scale was restored. One clearly labelled DEVICE TEST draft remains on the Note9; it was not submitted anywhere. iOS, large accessibility text and release-build frame-rate/haptic feel remain unverified; Expo Go checks are functional preview checks, not a release performance claim.

## Follow-up: service pins and private photo intake

Every resident-map pin now contains its service icon, using the same category mapping as the form and nearby list. Pins use the active palette and stop Android bitmap tracking after rendering. Physical Note9 screenshots confirmed roads, water and stormwater symbols inside the pins.

The report form accepts camera/library images, with up to three optional photos per submission. Photos are resized to a maximum 1600 px side, converted to JPEG and compressed to at most 400 KiB before sending. Compressed copies persist with drafts. Existing drafts without photos remain readable and can be continued. File writes/moves are awaited before confirmation, and measured image bytes determine the size limit.

Added the authenticated submitReport callable, shared allowlisted input validation, server JPEG decoding/re-encoding to strip metadata, private Storage uploads, owner-scoped idempotency reservations/leases, a persistent quota and committed receipts. Reports remain private/pending and are not municipality acknowledgements. Direct client writes/uploads remain denied. Explicit photo rejections allow correction; uncertain delivery preserves the exact retry payload. Production requires App Check; live sending stays disabled until deployment and native attestation are ready. See REPORT_INTAKE.md for the test and deployment steps.

The supplied Firebase configuration is in ignored local environment files for public web, ops and mobile. Public web initialization is wired without Analytics collection. The live project APIs timed out; no cloud resources, rules or billing settings were changed.

Validation: npm run verify passed with twelve tests, workspace type checks, lint, all three builds and the offline Expo dependency check. Integration tests exercised the real callable HTTP handler against Auth/Firestore/Storage emulators: unauthenticated rejection, three-photo upload, metadata removal, duplicate/concurrent retry handling, correction after invalid photos, daily quota, owner-only report reads and denied direct writes/private-media reads. CLI 14's Functions emulator is incompatible with SDK 7, and updated CLI downloads timed out; the documented HTTP-handler fallback was used instead.

Physical SM-N960F verification after a full Metro/Expo Go restart confirmed three synthetic 2400 px test images compressed to 44–45 KiB, saved/reopened with the draft, and uploaded successfully to the demo server. The app displayed and persisted a clearly marked test receipt (no real report filed). The normal preview settings were restored with live sending disabled. Production App Check, native identity restoration, camera capture permissions, iOS and release-build behaviour still require validation. The older local-only test draft and one clearly labelled emulator receipt remain on the device.

## Follow-up: service colours, Places and report coordinates

Added distinct paired light/dark colours for all thirteen service categories, applied to map pins and category symbols. Removed the Nearby, Report an issue and My reports navigation title bars and accounted for the system safe areas in each screen.

The location/landmark field now offers debounced Google Places suggestions, map confirmation, current location and manual pin placement. The full-screen Google map supports touch-and-hold pin dragging and tap placement, reverse address lookup, and explicit coordinate confirmation. GPS permission is requested only through Current location; denial, unavailable services and timed-out fixes leave manual selection available. Manual pin movement takes precedence over a late GPS result. Confirmed coordinates/source/place ID are retained with drafts and validated by the server submission contract; manual text edits clear a previously chosen pin.

The server-only lookupPlace callable requires resident authentication, enforces App Check outside emulators, rate-limits through Firestore, restricts provider endpoints/output fields and hides provider URLs/errors that could expose the key. The supplied GOOGLE_MAPS_SERVER_KEY secret was read from ride263-ddc3b through the existing user login and saved only in an ignored server secret file. The existing key's enabled Places Legacy and Geocoding endpoints returned real results; Places (New) is disabled in its actual owning project. No cloud API settings, billing, IAM roles or secret versions were changed. Deployment/key migration details are in PLACES_AND_REPORT_LOCATIONS.md.

Validation: npm run verify passed with sixteen tests, all workspace type checks, lint, web/ops/Functions builds and the offline Expo dependency check. Real provider checks confirmed autocomplete, selected-place details and reverse geocoding. Physical Note9 checks confirmed the coloured pins, title-free screens, real Harare suggestions, selected-place map, tap placement, long-press dragging, current GPS positioning, the system permission prompt, denied-permission fallback, manual placement without GPS and save/reopen of a fictional draft with matching coordinates. Original foreground location grants were restored. One additional clearly labelled local DEVICE TEST draft remains; no real report was submitted.

The current Note9 preview uses a local authenticated proxy plus demo Auth/Firestore services so Places searches can be exercised in Expo Go. Those local processes and ADB forwarding must stay available. Cloud deployment/native App Check, standalone map keys and iOS remain pending; report submission remains disabled.
