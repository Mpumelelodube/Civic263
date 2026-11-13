# Firebase reporting backend

Civic263 uses project `civic263-df6ec`. Firestore, Functions and the default Storage bucket are in `europe-west1`. The repository's default Firebase alias remains the emulator-only `demo-civic263`; use `--project civic263-df6ec` or the explicit `live` alias for deployments.

## Submission and viewing

- `submitReport`: authenticated, App Check protected, validated resident command. Accepts zero to three different compressed JPEGs, at most 400 KiB and 1600 pixels per side before upload. The server decodes and re-encodes each image to remove embedded metadata. An owner-scoped UUID reservation makes unchanged retries return the same receipt.
- `getMyReports`: owner-only history, 20 reports per page, with review and publication status. Client invocation requires the service's HTTP invoker policy as well as Firebase Auth and App Check.
- `getMyReport`: owner-only details, original submitted photos and separate resolution photos. Photos are returned through the authenticated callable, without permanent bearer download URLs or Storage download tokens.
- `lookupPlace`: authenticated, App Check protected Google Places/Geocoding proxy. The Maps key stays in the named Secret Manager secret.
- `publicApi`: bounded public incident pages, a 5 km nearby query, incident details and approved photo derivatives. Every incident response uses an explicit public allowlist.

The app saves a local draft before sending. Only a committed receipt means the platform received it. A receipt does not mean that a municipality received or acknowledged the issue. Clearing app data can remove the resident's anonymous device identity and access to its private reports.

## Resident-controlled resolution

The existing authenticated `submitReport` callable also accepts the strict lifecycle command `{ action: 'resolve', reportId, attemptId, location, photos }`. It verifies the signed-in identity owns the submitted report, and records `workflowStatus: resolved` with an allowlisted resident source and server-generated timestamp. Repeated requests return that same resolution. A private `reportEvents` entry records the actor once; actor UIDs are never included in public or owner response DTOs.

For an already published report, one transaction updates its canonical incident and public projection. Resolved records and approved photos remain in the register, detail URLs and CSV exports, while active nearby results and map pins exclude them. Private/held reports remain private, and queued or in-flight review cannot publish a resolved private report. Report/evidence timestamps and municipal handoff status are preserved. No staff approval or new HTTP-invoker permission is required.

The owner uses Mark resolved in My reports, checks a fresh GPS fix within 20 m of the original private saved pin (horizontal accuracy at most 20 m), takes 1�3 new in-app camera photos, then confirms. Gallery selection cannot supply resolution evidence. The final fix is at most two minutes old; capture fixes are within 30 seconds of capture and photos at most ten minutes old, with 15 seconds of forward clock tolerance. Mocked fixes, missing pins and invalid JPEGs fail before lifecycle commit. New intake now requires a confirmed pin; initial photos remain optional, at most three. Existing records stay readable.

Resolution evidence uploads use a bounded lease and unique private paths per attempt/lease, separately from initial photos. The app persists captured photos and freezes uncertain submissions for retry; a committed retry returns its original resolution time even after evidence ages. Owner details return the original and resolution photo sets separately.

The private `reviewResolution` event trigger reviews only the new evidence of an already-public resolved report. It uses existing Vision/Gemini privacy screening with a repaired-scene prompt, the shared daily review cap, bounded retries and isolated derivative batches. Pending, failed or privacy-held photos have no public route. Approved derivatives are served only via `/incidents/{id}/resolution-photos/{index}`; the canonical private batch pointer never enters the public DTO. Review failure never reopens a report or publishes a private record. This checks device-supplied evidence, not independent physical presence or repair verification.

After server confirmation the owner sees Resolved by you. Public history says Resolved by reporter with the date. The source is a resident observation. See [the approved specification](REPORT_RESOLUTION_SPEC.md).

Resolution acceptance on 12 November 2026 covered owner/non-owner access, stable concurrent retries, one audit event, retained private/public photos and record URLs, active geo exclusion, and resolution racing with both successful and failed review. The Note9 demo also passed confirmation cancellation, a failed request followed by retry, refreshed history and immediate pin removal. The portal showed the same archived record, loaded photo and date, and its CSV retained the resident source and timestamp. The live test command exercised only server-claimed synthetic test identities and left them private; no genuine existing report was changed.

Mobile nearby and public-detail reads request cache revalidation so a recently resolved report is not restored from the device's HTTP cache after its local nearby cache is invalidated.

## Backend dependency maintenance - 12 November 2026

The pre-deployment production audit found high-severity advisories in the existing image and request parsers. Sharp is now pinned to 0.35.5 and the deployed Functions package pins body-parser 2.4.0 through its override. These versions address the [Sharp native decoder advisories](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) and [body-parser compressed-request denial of service](https://github.com/advisories/GHSA-27r3-jxmh-p828). JPEG validation, metadata removal and the publication/resolution integration checks passed with the updated image library.

`npm audit --workspace @civic263/functions --omit=dev --audit-level=high` now exits successfully with zero high/critical findings. Eight moderate and one low finding remain in the existing Firebase/Google SDK dependency chain (including uuid and fast-xml-parser); a wider SDK update is separate maintenance. This is not a claim that the dependency tree has no advisories.

## Automatic publication

The `reviewReport` Firestore creation trigger claims a processing lease and runs the following sequence:

1. Test identities and emulator test receipts stay private without reaching publication checks.
2. Cloud Vision checks each image for faces, readable text and unsafe content. Text-bearing or uncertain images are excluded entirely.
3. Gemini 3.1 Flash-Lite on the EU multi-region endpoint checks relevance and privacy, then proposes a short neutral resident-attributed summary. Embedded instructions in submissions are untrusted data. The parser rejects invalid output, unsafe indexes and contact details; publication also requires a model confidence of at least 0.95. This is a decision threshold, not a measured accuracy claim.
4. Eligible text-only reports, or reports with at least one supplied photo that passes both checks get separate, metadata-stripped public derivatives, a canonical incident, a public projection and an audit record. Public coordinates are rounded to three decimal places. The original report and media stay private.
5. Uncertain, irrelevant or privacy-sensitive reports stay private with an owner-visible reason. Provider failures retry up to five attempts, then stay private. A duplicate event does not create another incident.

The pilot limits automatic review to 100 new reports per UTC day, intake to ten new reports per resident identity per day, and each function to two instances. Existing project billing covers metered Functions, Storage, Vision and model requests. Expiring quota collections use Firestore TTL; reports and receipts do not expire through these quota policies.

Automated checks can make mistakes. Publication is not an inspection, fact verification or an authority acknowledgement. Responsible municipality/service assignment remains unconfirmed rather than being invented. Manual operations, duplicate merging, municipal handoffs and evidenced resolution updates are later workflow work.

## Storage and service permissions

The bucket is `civic263-df6ec.firebasestorage.app`, with uniform bucket access and public access prevention. Firestore and Storage rules deny all direct client writes/uploads; Storage rules also deny direct media reads. The server serves approved public photo derivatives after checking the public record.

The dedicated `civic263-backend` service account uses the custom role and condition files in `firebase/iam`: default-database entity/transaction permissions, AI prediction/API quota use, Firestore event receipt and object get/create/delete restricted to report originals and incident derivatives. Object delete is needed for safe overwrite on an idempotent upload retry. Secret access is restricted to `GOOGLE_MAPS_SERVER_KEY`. The private review worker admits only the backend service account through Cloud Run invocation permission.

Resident callable HTTP endpoints must accept Firebase client traffic at the Cloud Run layer. Firebase Auth, App Check, input validation and owner checks remain enforced inside each callable. The public register contains only allowlisted published fields and approved images.

## Local preview and tests

The configured Note9 preview can use the live backend from Expo Go with a registered **development-only** App Check debug token. The value stays in ignored `apps/mobile/.env.local`; never commit it, display it, or configure it in a store build. Emulator and live Auth identities use separate Firebase app names. Production/store builds still need native device attestation. The existing Maps key is reused for the registered Android test app, as explicitly requested.

Set `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` empty and enable `EXPO_PUBLIC_REPORT_INTAKE_ENABLED` only after live checks pass. Restart Metro after changing environment values. Both web and mobile default to the deployed public API; `VITE_PUBLIC_API_URL` and `EXPO_PUBLIC_PUBLIC_API_URL` can override it for explicitly isolated testing.

Run `npm run verify` for the repository checks. With demo Firestore and Storage emulators running, `npm run test:publication` validates publication transactions, privacy projection, public photo derivatives, owner isolation, duplicate delivery, test isolation and capped retries. Its project and endpoints are hard-coded to demo/loopback services.

`python scripts/test-live-backend.py --account YOUR_EXISTING_GCLOUD_LOGIN` is an opt-in live check. It creates a fresh test identity, sets and verifies its server-controlled test claim, submits synthetic photos privately and checks Auth, App Check, idempotency, owner history/details, direct-write denial, private media denial and event delivery. All authentication tokens remain in memory; only a non-secret test receipt is saved under ignored `.local/`. Test reports cannot enter the public register.

On Windows, Firebase SDK discovery can exceed its default 10-second window. If deployment analysis times out, set `$env:FUNCTIONS_DISCOVERY_TIMEOUT='60'` for that deployment command. This changes local CLI discovery only, not request timeouts or access controls.

## Remaining release gates

Native App Check/device-attested builds, identity recovery/linking, iOS acceptance, orphan-upload retention, operational monitoring, appeals/corrections, pilot boundaries and responsible-service arrangements still require work before a public rollout. The current integration supports controlled testing of real reports; it does not claim those release gates are complete.

## On-site resolution deployment check � 12 November 2026

All eight functions and the public Hosting version were deployed successfully. The live synthetic-identity command test passed, including separate private resolution photos and stable receipts. The live resolution-purpose Vision/Gemini contract conservatively held synthetic patterns. Browser acceptance loaded both original and resolution derivatives in an isolated archive and then restored the live preview.

Deployment created `reviewResolution` as an ACTIVE private Eventarc worker with the existing backend service account for both runtime and delivery. The user explicitly approved the narrow `roles/run.invoker` binding on `reviewresolution` only for `civic263-backend@civic263-df6ec.iam.gserviceaccount.com`. It was applied and a successful Eventarc delivery (HTTP 204 at 17:19:59 UTC) was observed. Both review workers retain backend-service-account-only invocation; no `allUsers` or project-wide grant was added.


## Community review deployment: 13 November 2026

Community commands use the existing authenticated/App Check-protected submitReport callable. The private reviewResolution event worker now handles community photo privacy screening and bounded FCM delivery; no new public invoker grant was required. New fieldChecks, publicFieldChecks and inbox indexes are deployed. Direct client writes/uploads and private media reads remain denied.

The user approved and the deployment applied `projects/civic263-df6ec/roles/civic263NotificationSender` to the existing backend service account, containing only `cloudmessaging.messages.create`. A labelled private QA push reached the opted-in Note9 on the first attempt; its device-token registration was removed afterward. Both private review workers were rechecked for backend-service-account-only invocation after deployment.

`npm run test:community` exercises non-owner fix reports, independent opted-in confirmation/rejection, transactional notifications, current-fix/concurrent-write guards, private originals, public derivatives, stable retries and token-account rebinding against loopback demo emulators. It also checks private field-test isolation and Android/iOS push registration. Real camera and native reminder acceptance are recorded in ACCEPTANCE_TESTING.md. All six technical TTL policies are active, including the two community quota collections and the private field-test collection. Superseded committed-visit upload cleanup has a dry-run admin tool; retained and ambiguous uploads are excluded. See [native release acceptance](NATIVE_RELEASE.md) for current attestation, recovery and device gates.
