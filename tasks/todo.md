# Civic263 task tracker

Updated: 19 November 2026. See [plan.md](plan.md) for acceptance criteria, dependencies and verification. Build/device evidence remains the 13 November checkpoint; Firebase production APNs and Apple internal TestFlight availability were verified on 19 November. Checked items have recorded implementation/verification; unchecked items remain open.

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
- [ ] **R03 - Physical iPhone acceptance.** Install, verify App Attest, report/photo ownership and actual background push/deep linking.
- [ ] **R04 - Private field-test pause fix.** Pause locally before server calls and verify offline/expired-grant behavior.
- [ ] **R05 - Outdoor geofence crossing.** User deferred; renew test readiness only when needed, then observe real exit/entry/notification events.
- [ ] **R06 - Process/battery/permission acceptance.** Check background, force-stop/manual reopen, revocation and pause; retain identities and evidence.
- [ ] **R07 - Main Android distribution acceptance.** Verify Play setup/recognition and the main package without clearing the existing debug identity.
- [ ] **R08 - Compatible dependency updates.** Triage the recorded 25 findings; no critical findings were recorded, but the four high findings are not patched by a reachability assessment.

The last Note9 test/service was active at the 13 November handoff. No successful pause or outdoor crossing was subsequently verified; its two-hour grant has expired. Recheck and pause it before leaving it unattended; do not infer current device state from claim expiry. Rebuild affected candidates after fixes before recording a new device pass.

## Acceptance checkpoints

- [x] Configuration complete: R01 and R02.
- [ ] Physical device acceptance complete: R03-R07, with temporary tests paused/cleaned.
- [ ] Dependency risks reviewed: R08 and any necessary compatible native rebuilds.

## Public pilot gates

- [ ] **P01:** account deletion/withdrawal/correction and agreed retention behavior.
- [ ] **P02:** moderation appeals, abuse handling, held-content ownership and support/escalation.
- [ ] **P03:** monitoring, budget/quotas, backup/restore and broader safe retention/cleanup procedures.
- [ ] **P04:** pilot boundaries, service contacts, emergency guidance, privacy/reuse terms and an explicit rollout decision.

## Later product backlog

- [ ] **L01:** complete staff operations authentication/roles, duplicate merge, assignments, exports and evidenced handoffs.
- [ ] **L02:** interactive public multi-incident map, area/freshness aggregates, governed snapshots, scale/search improvements and later languages/browser reporting.

Do not mark an item complete for source code alone when its acceptance criterion requires deployment, processing or an actual device observation. Update this list and the implementation checkpoint after each completed slice.
