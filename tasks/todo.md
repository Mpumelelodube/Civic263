# Civic263 task tracker

Updated: 25 November 2026. See [plan.md](plan.md) for acceptance criteria, dependencies and verification. Build/Android device evidence remains the 13 November checkpoint; Firebase production APNs and Apple internal TestFlight availability were verified on 19 November. Checked items have recorded implementation/verification; unchecked items remain open.

## Completed checkpoint - ece8053

- [x] Workspace, shared domain, CI/check commands and browser/native separation.
- [x] Mobile map dashboard, five-kilometre loading, service icons/colours, light/dark themes, typography and motion.
- [x] Zimbabwe Places lookup, map pin selection and optional current-location permission.
- [x] Persistent drafts/retries and server-confirmed report receipts.
- [x] Optional initial photos, maximum three; compressed JPEGs and private original storage.
- [x] Auth/App Check-protected intake and owner-only report/photo retrieval.
- [x] Automated privacy/publication review and allowlisted public records/derivatives.
- [x] Deployed public register, selected-location map embed, detail galleries, community history, resolved archive and safe CSV fields.
- [x] Public-led fix reports and independent opted-in confirmation/rejection from mobile.
- [x] On-site 20 m checks and 1-3 fresh in-app camera photos for resolution visits.
- [x] Private inbox, opt-in reminders, Android FCM delivery and token-account isolation.
- [x] Native background task/geofence implementation and Note9 grants/service registration.
- [x] Optional account linking/password recovery, UID preservation and ownership-isolation tests.
- [x] Signed standalone Android artifacts; side-by-side Note9 cold start without Metro and valid live native attestation.
- [x] Signed iOS 0.1.0 build 4; production App Attest/APNs entitlements and export declaration verified in the archive.
- [x] Approved APNs key assigned to Civic263 in EAS.
- [x] Six technical TTL policies active; conservative upload-cleanup tool self-test and no-delete dry run.
- [x] Repository verification rerun 19 November: 37 tests, types, lint and builds; dependency check offline.
- [x] Implementation checkpoint committed and pushed to the existing branch.

## Immediate release queue

- [x] **R01 - Firebase APNs upload.** Production key `8LFLW7W3U9` / team `25L4M5VTCR` saved for the intended iOS client and verified after a console reload on 19 November. Private material remains ignored; real delivery is R03.
- [x] **R02 - TestFlight access/submission.** App `6836809635` and approved existing key `GR74QN3BR3` configured; submission `d102ea16-59e6-4305-b2d1-9a7dd6fb2488` finished. Apple reports 0.1.0 build 4 `VALID` and internally `IN_BETA_TESTING`; the owner's confirmed iPhone account has internal group access. Physical installation is R03.
- [ ] **R03 - iOS device acceptance.** Build 5 installed on the iPad and retained the submitted report, but exposed the preserved-files warning for a saved photo draft. The matching iOS container-path defect is fixed in source `8c428f7`: safe legacy photo paths resolve under current Documents and new saves store relative paths. Repository verification passed on 21 November with 52 tests, types, lint, builds and offline Expo dependency validation. Build 6 (`7c276e2d-186d-4988-b701-ea809f2adf41`) and submission `daf68990-cdfb-47ff-b089-9c9b11002577` finished; Apple reports version 0.1.0 (6) VALID, unexpired and internally IN_BETA_TESTING for the intended app, linked to that exact build. Preserved-draft/text/photo recovery and notification report-link device retests remain pending. Physical iPhone coverage remains deferred and unverified.
- [ ] **R04 - Private field-test pause fix.** Source fixed (24 November): `stopOwnFieldTest` now pauses background/geofence work locally before any server call; an offline or expired-grant server stop leaves the device paused and shows a pending-cleanup notice, with no automatic renewal. Four focused ordering tests added; repository verification passed (56 tests). Still open: a rebuilt acceptance candidate and a native task/service-registration check on the Note9, which also still needs its stale 13 November state confirmed paused.
- [ ] **R05 - Outdoor geofence crossing.** User deferred; renew test readiness only when needed, then observe real exit/entry/notification events.
- [ ] **R06 - Process/battery/permission acceptance.** Check background, force-stop/manual reopen, revocation and pause; retain identities and evidence.
- [ ] **R07 - Main Android distribution acceptance.** Verify Play setup/recognition and the main package without clearing the existing debug identity.
- [ ] **R09 - Large-screen (tablet/foldable) experience.** Implemented in source (24 November), device acceptance pending. iPad support and free rotation declared; window-size-driven chrome (bottom tabs, navigation rail, full sidebar); Nearby map with a floating inspector (counts, service filters, list, preview, in-place details); report composer with an inline service grid and a sticky readiness column; list/detail for My reports and Community; centred form sheets. Layout, grouping and readiness rules are unit-tested (65 tests). Needs a native rebuild, then checks on iPad portrait/landscape, split view/Stage Manager, an Android tablet and a foldable, including keyboard, dark mode and large text.
- [x] **R08 - Compatible dependency updates.** Done 24 November: 25 findings (4 high, 20 moderate, 1 low) reduced to 12 moderate with no high, low or critical. A `@grpc/grpc-js` 1.14.6 override fixes the Firebase gRPC high chain, and in-range Expo CLI, node-forge, fast-xml-parser, Storage and lint updates cleared the rest. No SDK change or downgrade. The 12 unpatched moderates (Firebase Admin `uuid`, which needs `firebase-admin` 14; Expo fingerprint `glob`/`minimatch`, which needs an Expo toolchain update) are recorded with reachability in [dependency audit](../docs/DEPENDENCY_AUDIT.md). Verified with `npm run verify` (65 tests) and the publication, community, intake and identity emulator suites. No native dependency changed.

The last Note9 test/service was active at the 13 November handoff. No successful pause or outdoor crossing was subsequently verified; its two-hour grant has expired. Recheck and pause it before leaving it unattended; do not infer current device state from claim expiry. Rebuild affected candidates after fixes before recording a new device pass.

## Acceptance checkpoints

- [x] Configuration complete: R01 and R02.
- [ ] Physical device acceptance complete: R03-R07, with temporary tests paused/cleaned.
- [x] Dependency risks reviewed: R08 (no native rebuild needed for these JavaScript-only updates; follow-up majors are recorded in the dependency audit).

## Public pilot gates

- [ ] **P01:** account deletion/withdrawal/correction and agreed retention behavior. Rules agreed 25 November in the [account lifecycle spec](../docs/ACCOUNT_LIFECYCLE_SPEC.md):
  - Deletion keeps published issues as anonymous records, erases everything private and runs immediately.
  - Withdrawal unpublishes an issue unless another resident added evidence.
  - Corrections are allowed only before publication.

  Implemented in source with a new emulator suite (`npm run test:lifecycle`, 7 scenarios including the built callable) and repository verification (69 tests). The publication, community, intake and identity suites still pass. Still open: approval to bind the new `firebaseauth.users.delete` role to the backend service account; deploy Firestore indexes (adds the seventh TTL policy, on `accountDeletions`) and Functions; device acceptance of withdraw/correct/delete on a rebuilt candidate; and confirmation of the rules with the operating authority (P04).

- [ ] **P02:** moderation appeals, abuse handling, held-content ownership and support/escalation.
- [ ] **P03:** monitoring, budget/quotas, backup/restore and broader safe retention/cleanup procedures.
- [ ] **P04:** pilot boundaries, service contacts, emergency guidance, privacy/reuse terms and an explicit rollout decision.

## Later product backlog

- [ ] **L01:** complete staff operations authentication/roles, duplicate merge, assignments, exports and evidenced handoffs.
- [ ] **L02:** interactive public multi-incident map, area/freshness aggregates, governed snapshots, scale/search improvements and later languages/browser reporting.

Do not mark an item complete for source code alone when its acceptance criterion requires deployment, processing or an actual device observation. Update this list and the implementation checkpoint after each completed slice.
