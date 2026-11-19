# Civic263 delivery plan

Updated: 19 November 2026. Implementation checkpoint: `ece8053`. Build/device evidence is from 13 November; Firebase production APNs and Apple internal TestFlight availability were verified on 19 November.

Civic263 is at controlled native release acceptance. Reporting, private photos, automatic publication review, the live public portal and community resolution are implemented. Android standalone acceptance has passed; the iOS archive is built. Public rollout has not passed its remaining device and operational gates.

Use [todo.md](todo.md) as the open task list. [Implementation status](../docs/IMPLEMENTATION_STATUS.md) records the current checkpoint; [native release notes](../docs/NATIVE_RELEASE.md) and [acceptance evidence](../docs/ACCEPTANCE_TESTING.md) record what was actually verified. The [product plan](../docs/PRODUCT_PLAN.md) holds the agreed product direction and longer-term proposals.

## Delivery state

| Area                                                 | State                           | Evidence or limit                                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace, shared domain and repository checks       | Complete                        | 37 tests, types, lint and all builds pass; SDK dependency validation ran offline.                                                                                                 |
| Resident map and reporting                           | Implemented                     | Five-kilometre viewport loading, service icons/colours, system themes, location search/map/GPS, persistent drafts and at most three compressed photos.                            |
| Firebase intake, Storage and publication             | Deployed                        | Auth/App Check, server commands, private originals, reviewed derivatives, owner-only history and six technical TTL policies.                                                      |
| Public portal                                        | Deployed                        | Published register, selected-issue OpenStreetMap embed, details/photos, community history, resolved archive and allowlisted CSV. Full multi-incident interaction remains planned. |
| Community resolution                                 | Deployed and demo-tested        | Any resident proposes a fix; another opted-in identity confirms/rejects; fresh on-site GPS within 20 m and 1-3 new camera photos.                                                 |
| Account recovery                                     | Implemented and emulator-tested | Optional email/password linking retains the UID; recovery restores private ownership.                                                                                             |
| Android release                                      | Built; acceptance app installed | Signed ARM64 artifacts, no Metro dependency, live native App Check/Auth validation. Main Play-recognized distribution remains open.                                               |
| iOS release                                          | Internal TestFlight ready       | Version 0.1.0 build 4 validated by Apple and active for the owner's internal testing. Physical installation, App Attest and push remain open.                                     |
| Nearby/background alerts                             | Implemented; acceptance partial | Note9 grants/service and earlier notification tests passed. Physical crossing and battery/termination checks remain open.                                                         |
| Operations dashboard and advanced incident workflows | Scaffold/proposed               | Staff roles, duplicate merge, assignment and official handoffs are not finished workflows.                                                                                        |

## Next tasks, in order

### R01 - Finish Firebase APNs configuration - complete

Firebase Cloud Messaging now shows production APNs key `8LFLW7W3U9`, Apple team `25L4M5VTCR`, for `co.zw.civic263.mobile`. The saved configuration was verified after a console reload on 19 November. The existing EAS assignment and other apps/keys were preserved. The development APNs slot remains unconfigured; the signed TestFlight archive uses production APNs.

- Acceptance: the correct Firebase iOS client shows the intended key/team; the private key stays out of source/logs; existing apps and keys are preserved.
- Verification: inspect the saved Firebase configuration. Actual iPhone delivery is R03.
- Evidence: the correct Firebase project/client and saved key/team were inspected through Chrome. Private key material remains in an ignored, access-restricted signing folder.
- Likely files: `docs/NATIVE_RELEASE.md`, `docs/ACCEPTANCE_TESTING.md`. Scope: small configuration task.

### R02 - Establish TestFlight access for the finished archive - complete

App Store Connect app `6836809635` is configured for `co.zw.civic263.mobile`. Existing submission key `GR74QN3BR3` (EAS) was explicitly approved and assigned to Civic263. EAS submission `d102ea16-59e6-4305-b2d1-9a7dd6fb2488` finished successfully. On 19 November, Apple's API reported version 0.1.0 build 4 as `VALID`, unexpired and `IN_BETA_TESTING` internally, linked to the exact EAS build/submission. The owner's confirmed iPhone Apple account has access to the automatically assigned `Team (Expo)` internal group. External beta review/public distribution were not performed; physical installation is R03.

- Acceptance: record the App Store Connect app ID and approved credential reference; submit the intended version/build; verify Apple processing and availability to the intended tester.
- Verification: EAS submission status plus App Store Connect/TestFlight state, not a queued-job message alone.
- Dependency: Apple account/app access and any explicit approval required for a newly identified credential or expanded scope. Signing team is already confirmed.
- Likely files: `apps/mobile/eas.json`, `docs/NATIVE_RELEASE.md`. Scope: small configuration task. No public App Store release or new tester invitations are implied.

### R03 - Verify the iPhone app and push delivery

Install the processed TestFlight build on the available iPhone and exercise the actual native providers.

- Acceptance: private commands pass App Attest with owner isolation; map/themes, location, camera/gallery and report retrieval work; an opted-in background push arrives and opens the correct report.
- Verification: physical iPhone results, OS/build identity and sanitized server/device evidence in the acceptance document.
- Dependencies: R01 and R02; an available iPhone and a clearly labelled private/demo issue.
- Likely files if fixes are needed: the Swift bridge, `native-firebase.ts`, `nearby-alerts.ts`, `app.config.ts`, acceptance notes. Scope: medium.

### R04 - Make the private test pause reliably

The private field-test stop helper currently calls the server before pausing locally. Correct this before the next field run so an expired grant or lost connection cannot block the device pause. Main Community preference pausing already persists locally on failure.

- Acceptance: the device stops its background/geofence work before any remote request; offline/expired access leaves it paused; the UI explains any server-record cleanup still pending.
- Verification: a focused failure/expired-access check and a native service-registration check, followed by repository verification.
- Dependency: none. Never silently renew the two-hour test access.
- Likely files: `services/field-test.ts`, the field-test screen, a focused test, acceptance notes. Scope: medium.

### R05 - Complete the real geofence walk

The user deferred the walk. When the user is ready, start a fresh private 200 m target, background the installed app, leave the region safely, wait for an exit and return. The 13 November handoff observed the test/service active; pausing was requested but was not verified. Its two-hour authorization has expired. Recheck device state and obtain any needed fresh bounded authorization before starting; claim expiry is not evidence that device background preferences were paused.

- Acceptance: actual OS exit, entry and notification acknowledgement are recorded; no public report or route history is created; cooldown/stop behavior remains correct.
- Verification: private event kinds/sources and the observed phone alert. Simulated movement does not satisfy this gate.
- Dependency: R04, device/user availability, precise/background grants and a valid bounded test grant.
- Likely files: acceptance notes; create a separate focused fix task if the device test fails. Scope: small manual test.

### R06 - Check process, permission and battery recovery

- Acceptance: foreground/background transitions and cold reopen retain state; force-stop correctly disables work until manual reopen; permission revocation and pausing remove jobs without losing private reports; push delivery works on the signed Android candidate.
- Verification: physical Note9 task/service observations and the same checks on iOS where applicable. Record OEM battery restrictions and OS limitations.
- Dependencies: R04 and installed builds; perform around R05 without interrupting a live walk.
- Likely files: `nearby-alerts.ts`, `community-runtime.tsx`, acceptance notes if a fix is needed. Scope: medium.

### R07 - Validate the main Android distribution path

- Acceptance: confirm Play Console/app access and a controlled recognized-distribution route; the main signing certificate passes its strict App Check policy; installation/update preserves the intended resident identity.
- Verification: main-package device acceptance through the selected testing track. The side-by-side off-Play acceptance app is not evidence of Play recognition for the main package.
- Dependency: existing Play account/app setup, which has not been verified in this release session. Back up/link older anonymous identities before any package replacement; do not uninstall the debug app to bypass a signing mismatch.
- Likely files: `eas.json`, `app.config.ts`, native release notes. Scope: medium configuration/test task. EAS Android cloud secrets are optional and remain unconfigured; local signed artifacts already exist.

### R08 - Review compatible dependency security updates

- Acceptance: triage the recorded 25 audit findings (4 high, 20 moderate, 1 low); apply compatible fixes; record unresolved findings and reachability without treating them as patched.
- Verification: fresh audit, `npm run verify`, relevant integration suites and native rebuilds when native dependencies change.
- Dependency: none; keep Expo SDK compatibility and avoid forced Firebase downgrades.
- Likely files: root/package workspace manifests, lockfile and release notes. Scope: medium; split further if a supported SDK upgrade is necessary.

## Checkpoints

Rebuild affected signed candidates after code fixes and record the new build IDs before device acceptance. Build 4 is the current inspected iOS baseline, not a promise that it includes future fixes.

1. Configuration ready: R01 and R02 complete; no claim of installed iPhone acceptance yet.
2. Device acceptance ready: R03-R07 complete with recorded evidence and paused/cleaned temporary tests.
3. Pilot ready: the operational gates below are resolved, relevant regressions pass and a responsible owner accepts the rollout boundary.

## Work still outside the completed release slice

These remain open epics, not implemented features or ready-to-code single tasks. Break each into small command/UI/verification tasks before implementation.

- P01: account deletion, contribution withdrawal/correction and retention rules that preserve appropriate public history and private rights.
- P02: appeals, abuse handling, held-content review ownership and accountable support/escalation procedures.
- P03: monitoring/alerts, cost controls, backup/restore exercise and a broader orphan/retention policy. The existing cleanup tool only handles proven superseded committed-visit leases.
- P04: pilot/service boundaries, verified contacts, emergency guidance, privacy/reuse terms, distribution metadata and rollout decision. No official municipal acknowledgement is implied.
- L01: staff operations access, duplicate linking/merge, assignments, controlled exports and evidenced service handoffs.
- L02: interactive public multi-incident map (the current public embed shows the selected location), area/freshness aggregates, governed full snapshots, larger-scale search and later languages/browser reporting.

The public-led review model does not require finishing a staff operations dashboard before community acceptance. A different UID establishes a different account, not a verified different human. AI privacy approval is separate from community confirmation that a defect is fixed.

## Existing authorization and constraints

- Reuse the existing Maps credential; do not create another Maps key.
- APNs key `8LFLW7W3U9` is explicitly approved for Civic263 in EAS and Firebase, including its shared use with `263-gaming`.
- Copying the Android Maps key/client file to EAS was rejected for lack of destination-specific approval. Complete the local release path without assuming that extra upload is authorized.
- Browser URL verification failure is a tooling restriction; it does not revoke the approved APNs action. Do not bypass the restriction with another UI mechanism.
- Keep genuine reports unchanged during tests. Secrets, private evidence, native Firebase files and build outputs remain outside Git.
