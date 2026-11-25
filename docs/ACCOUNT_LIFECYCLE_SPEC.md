# Spec: withdrawal, correction and account deletion (P01)

Status: behaviour agreed on 25 November 2026. These are product rules for the pilot, not legal conclusions. Confirm them with the operating authority before public rollout (P04).

## Decisions

| Question                                     | Agreed rule                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account deletion and published issues        | Published issues and the resident's public fix checks stay as anonymous civic records. Everything private or linked to the identity is erased, and the sign-in is deleted.                                                                                                                                                                              |
| Withdrawing one published report             | If no other resident has recorded a fix check on it, the issue leaves the register and map and its public photos are deleted. If others have, the issue stays: the reporter's photos and summary are removed and it shows that the original report was withdrawn.                                                                                       |
| Correcting category, description, place, pin | Allowed only while the report is unpublished (waiting for review, retrying or held), up to three times per report. A correction goes back through automatic review. Photos can be removed but not added. Published reports are withdrawn and sent again instead, so the private pin that community 20 m checks depend on never moves after publication. |
| When deletion runs                           | Immediately. Background work and push stop on the device first; the server erases within minutes. Nothing can be undone. Backups expire on their own schedule (P03).                                                                                                                                                                                    |

## Withdrawal

Owner only. A withdrawn report stays in the resident's own history as **Withdrawn** with its reference, service and dates. Its description, place text and photos are erased at once; it cannot be corrected or withdrawn again. Repeating the command returns the first result.

| Report state                              | Outcome       | Public effect                                                                                                                                               | Private effect                                                                                     |
| ----------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Unpublished (queued, retrying, held)      | `private`     | None. Any review still running cannot publish it.                                                                                                           | Text, pin and photos erased.                                                                       |
| Published, no other resident's fix checks | `unpublished` | Projection removed from the register, map, CSV and detail URLs; all public photos deleted. The canonical incident keeps only a non-personal tombstone.      | Text, pin, photos and the reporter's own fix checks erased.                                        |
| Published, another resident's fix check   | `retained`    | Issue stays. Summary replaced with a withdrawal notice; original and resident-resolution photos removed; others' fix checks and their approved photos stay. | Text and photos erased. The private pin is kept only as the site anchor for community 20 m checks. |

A withdrawn report sends the reporter no further community notifications. Public API responses can be cached for up to 30 seconds; photos already downloaded by others cannot be recalled.

## Correction

Allowed when the report is pending, unpublished, not resolved, not being reviewed at that moment and has fewer than three corrections. The command carries the revision it was based on; a stale revision is refused rather than overwriting newer state. The corrected version replaces the old one: earlier text is **not** kept, so a resident can remove personal details they included by mistake. Removed photos are deleted from private storage. The report returns to the review queue and a private event triggers a fresh automatic review under the normal daily cap.

## Account deletion

Resident confirms in Account. The device first pauses background alerts, geofences, any private field test and push, then calls the server until it reports completion. The server:

1. Marks the account as being deleted (a SHA-256 of the UID, kept 30 days) so a still-valid token cannot add new data.
2. For each report: if published, removes the owner link, text, place text and photos and keeps the anonymous public issue and private site pin; otherwise deletes it.
3. Deletes every private original its records name (report, resolution and fix-check photos) before erasing those records. The backend role can delete objects but not list them, so deletion uses exact object names. Uploads left over from abandoned attempts, which no record names, stay private until the operator orphan cleanup (P03) removes them.
4. De-identifies the resident's fix checks and events (the actor becomes `erased-resident`, location fixes removed). Pending evidence becomes private because its originals are gone. A fix they proposed can still be confirmed or rejected by others.
5. Deletes the community profile, inbox, device and push registrations, submission reservations, field-test record and quota counters.
6. Deletes the Firebase Auth user last. This needs the `firebaseauth.users.delete` permission (`firebase/iam/backend-account-deletion-role.yaml`), which the backend service account does not have yet; binding it requires explicit approval at deployment.

Each step can be repeated, so an interrupted deletion resumes. Afterwards the device deletes its drafts, saved evidence, alert state and cached reports, signs out and starts with a new anonymous identity.

Kept after deletion: anonymous public issues and approved photos, anonymous fix-check history, review audit records (report ID and decision only) and canonical incident tombstones. None contain the UID, contact details or original text.

## Verification

- Domain unit tests for the withdrawal outcome, correction eligibility and command parsing.
- `npm run test:lifecycle` against loopback demo emulators: all three withdrawal outcomes, review racing a withdrawal, stale and repeated corrections, re-review after correction, and full account erasure including Auth, Storage, community records and the stale-token guard.
- Device acceptance (deferred with the other native checks): withdraw, correct and delete on a build, with local state cleared afterwards.

## Out of scope

Staff-reviewed corrections after publication, an undo window, contact-based identity verification, and retention periods for reports that stay unpublished. These are listed under P02/P03.
