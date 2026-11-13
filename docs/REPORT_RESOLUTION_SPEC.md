# Spec: resident-reported resolution

Status: behaviour and implementation approved on 12 November 2026. No genuine existing report may be resolved merely to test the feature.

## Objective and assumptions

Let the original reporter mark their submitted report as resolved, remove its published pin from active maps, and preserve its record and photos. This records the resident's observation, not an independently verified repair or a municipal acknowledgement.

Civic263 is community led: residents are responsible for raising issues and recording when their reports have been resolved. This action does not require staff approval. Automated privacy/publication checks remain separate from that resident-controlled lifecycle.

The current publication model creates one incident for each approved report. Resolving a report affects that report and its corresponding incident only. Other residents' separate reports about the same location remain unaffected. Drafts and unconfirmed submissions are not eligible for this action.

## Resident flow

1. Open a submitted report from My reports.
2. Choose **Mark resolved** on its owner detail screen.
3. Check a fresh foreground GPS position within 20 metres of the original private report pin. Require reported horizontal accuracy at most 20 metres, reject mocked, stale or future positions, and explain retry/permission errors. No manual map position can satisfy this check. Legacy reports with no pin cannot use this flow; newly submitted reports require a confirmed pin.
4. Capture 1�3 new photos using the in-app camera only, checking position at each capture and again before sending. Gallery selection is unavailable for resolution evidence. Initial report photos remain optional, at most three.
5. Confirm the action after seeing that the active pin will be removed and the report will remain in history. Preserve pending evidence on delivery failure. The server validates ownership, timestamps, distance, accuracy, photo count and actual JPEG bytes before committing.
6. Wait for the server to confirm the change. Disable repeated submission while the request is pending.
7. Show **Resolved by you** with the recorded date. Keep the description, location, receipt, review history and original photos accessible.

An offline or failed request must not claim success or remove the pin optimistically. Refreshing or retrying checks the same report. A report already resolved by this action returns its existing result, without a second resolution event or a changed resolution timestamp.

## Records, publication and maps

- Record the resolution time on the server and identify its source as the resident. Keep internal attribution private; public records must never include the reporter's UID or contact information.
- Set the report's workflow to resolved. Preserve its separate moderation, publication and municipal handoff states.
- If already public, retain the public incident, approved photos and detail URL. Show **Resolved by reporter** and its date in the public record and the portal's resolution/archive view.
- If private or held for review, keep it private. Marking it resolved does not approve or publish its content.
- Exclude resolved records from active nearby API results and map pins in both mobile and public web. Opening an archived record must not put its pin back on an active map.
- Keep resolved reports available in My reports, and keep previously published records in the public register, archive and permitted data exports.
- Preserve original report/evidence timestamps and photo files. Resolution must not make old evidence appear newly inspected or acknowledged.
- Invalidate the resolving client's nearby cache after success. Other open clients pick up the change through their existing refresh cycle; this first version does not add push delivery.
- A queued or in-progress automatic review must not publish a previously private resolved report or restore an active pin after resolution. Resolution and review writes must have a consistent outcome under concurrent execution.

## Technical context and project structure

Use the existing npm workspaces, Expo SDK 58 mobile app, React portal, Firebase Auth/App Check, Firestore transactions and explicit response projections. No new dependency or authentication flow is required.

- `packages/domain/src`: shared resolution metadata, validation, workflow labels and public/owner response types.
- `functions/src`: validated owner command, transactional record updates, review concurrency handling and active nearby filtering.
- `apps/mobile/src/services` and `apps/mobile/src/screens`: callable integration, confirmation, owner status and map refresh.
- `apps/web/src`: public attribution/date, retained archive records and active map filtering, preserving the existing Achromatic ledger design.
- `functions/src/*.test.ts`, `packages/domain/src/*.test.ts` and `scripts`: command/security tests and isolated integration checks.

Follow the existing TypeScript style and boundary validation; for example, the current request parser accepts only the requested identifier field:

```ts
const id = reportRequest(data, 'reportId')!;
```

All workflow writes go through an authenticated, App Check-protected server command. Client Firestore/Storage writes remain denied. Public resolution fields are explicitly allowlisted; old records without resolution metadata remain readable.

## Commands and verification

Run commands from the repository root:

```powershell
npm run test
npm run typecheck --workspace @civic263/mobile
npm run build --workspace @civic263/functions
npm run test:publication
npm run verify
```

`test:publication` requires the isolated demo Firestore and Storage emulators. Extend the repository's existing test entry points for resolution checks rather than using production reports as fixtures.

Success criteria:

1. Only the authenticated owner can resolve a submitted report. Missing/foreign reports reveal no private information; unsigned, unattested and malformed commands fail.
2. The owner receives a server-confirmed, stable resolution time. Repeated or concurrent retries produce one resolution event.
3. The active pin disappears while the original record and photos remain readable in their existing privacy scope.
4. The public archive identifies resident-reported resolution without claiming municipal verification or changing handoff status.
5. Resolving held/private content never makes it public. A review/resolution race cannot create or restore an active pin.
6. Existing records, report submission, owner history, public photo access and pagination continue to work.
7. Note9 checks cover confirm/cancel, failed delivery/retry, retained photos, refreshed history and pin removal. Browser checks cover retained public detail/photos and the resolution archive.

Baseline before implementation: `npm run verify` passed on 12 November 2026 with 21 tests, workspace type checks, lint and builds. The Expo dependency check ran offline. These baseline checks do not test this proposed feature.

## Boundaries and open questions

- Always: verify ownership on the server, preserve report/media records, maintain public allowlists, handle concurrent review safely, and test with isolated labelled fixtures.
- Ask first: changes to this agreed behaviour, additional identity/access permissions, or resolving any genuine existing report as part of testing.
- Never: delete a report to hide its pin, resolve another resident's report, expose reporter identity publicly, publish private content through resolution, or invent an authority acknowledgement.

The initial scope is the confirmed mark-resolved action and retained archive; reopening and independent resolution verification are outside this slice.

## On-site evidence amendment � approved 12 November 2026

Resolution originals and their device-supplied capture/location metadata are private and separate from initial report photos. Owner detail retains both sets. Already-public records receive approved resolution derivatives only after the existing automated privacy checks; pending or rejected evidence never becomes publicly accessible. This screening does not approve the resident's lifecycle action or independently verify a repair. Private/held records stay private. Legacy resolutions are readable without inventing historical camera/GPS evidence.

Location and camera metadata are client supplied, protected by the existing authenticated/App Check command boundary, and are not cryptographic proof of physical presence. A dedicated native build with stronger device attestation is a separate release concern. Use the unrounded private saved report pin, never approximate public coordinates, for proximity validation. Final fixes must be at most two minutes old; photo capture fixes must be within 30 seconds of capture and photos at most ten minutes old. Allow at most 15 seconds of forward clock skew. Invalid evidence cannot close a report; committed retries return the stable receipt even after the evidence ages.
