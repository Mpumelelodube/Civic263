# Civic263: product design and implementation plan

**Project name:** Civic263 (deployment domain to be selected)

**Prepared:** 9 November 2026

**Status:** Version 2 - Zimbabwe positioning and public portal redesign baseline
**Requested stack:** React Native + Expo, Firebase, Google Maps, iOS and Android

## 1. Product recommendation

Build a municipal issue reporting platform with three connected surfaces:

1. **Resident mobile app:** open the app, report an issue, and track or update reports from the same app installation. No visible registration or sign-in.
2. **Public website:** Zimbabwe's public municipal issue register: an accessible map/list, reviewed evidence and response history, area summaries, and privacy-safe reusable public data. This is the main market proposition, with one pilot municipality initially.
3. **Private operations dashboard:** review submissions, combine duplicates, route incidents to responsible teams, manage progress, moderate public content, and report on performance.

Use **silent Firebase Anonymous Authentication** for residents. This gives the backend an identity for ownership without asking for a name, email, password, or phone number. Staff use named, authenticated accounts. Anonymous to the public does not mean the system collects no identifiers. Explain this plainly in the privacy notice. [S1]

Distinguish a **report** from an **incident**. A report is one resident's submission. An incident is the real-world problem being managed. Five submissions about one pothole should produce five private report receipts and one public incident pin.

### Initial assumptions

- Launch in Zimbabwe, initially in one municipality still to be selected; municipality IDs and staff scoping exist from the start. Harare in design examples is illustrative, not a confirmed pilot.
- English first; store user-facing strings separately for later local languages.
- The platform initially operates independently unless a municipality partnership is confirmed.
- A moderation team will review submissions during published operating hours.
- No emergency dispatch, live emergency monitoring, repair guarantee, or automatic municipal acknowledgement is implied.
- Photos are supported; video, public comments, and direct messaging are deferred.
- The public site is read-only in the MVP. Public reporting through a browser can follow later.
- Apple Developer, Google Play Console, and a Google Maps key already exist; project configuration, service enablement, restrictions, signing, and store submissions still need to be completed.

## 2. Product principles

| Principle                              | Product consequence                                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Report quickly                         | Category, issue location, short description; photos optional. Aim for a typical report in under a minute. |
| No account barrier                     | Anonymous identity happens silently; no sign-in screen for residents.                                     |
| Show honest progress                   | Separate saved locally, received by the platform, reviewed, municipality notified, and repair progress.   |
| Protect residents                      | No reporter identity, private contact details, push token, or raw device identifier on the public site.   |
| Group the same problem                 | Link submissions to a canonical incident instead of multiplying public pins.                              |
| Work on weak connections               | Persistent drafts, visible queue states, resumable/retryable submission, and manual location entry.       |
| Keep ownership enforceable             | A public reference or copied report ID never grants edit access.                                          |
| Make accepted evidence useful publicly | Every published issue has a stable link, evidence freshness, safe history and reusable approved metadata. |
| Show the limits of the dataset         | Coverage and participation are visible; counts are not a census of faults or an official authority score. |

## 3. Categories and routing

Categories, subcategories, departments, service coverage, default urgency, form prompts, and public visibility should be configuration data rather than hardcoded lists.

| Category                            | Example subcategories                                                 | Likely responsible service                  | Special behavior                                                                         |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Roads and pavements                 | Pothole, damaged road surface, collapsed shoulder, damaged pavement   | Roads / engineering                         | Capture road name and direction or nearest landmark.                                     |
| Traffic lights / robots             | Lights out, stuck signal, damaged signal pole                         | Traffic engineering                         | Ask for intersection and affected direction.                                             |
| Road signs and markings             | Missing stop sign, damaged sign, faded markings                       | Traffic engineering                         | Road safety urgency prompts.                                                             |
| Sewer and sanitation                | Sewer overflow, blocked sewer, damaged pipe, open sewer chamber       | Water / sanitation                          | Flag exposure risk; do not ask residents to approach.                                    |
| Water supply                        | Burst pipe, visible leak, no water, damaged public tap                | Water utility                               | Separate individual fault from area outage.                                              |
| Stormwater and flooding             | Blocked drain, flooded road, damaged culvert                          | Stormwater / roads                          | Emergency guidance for immediate danger.                                                 |
| Streetlights and public electricity | Streetlight out, fallen pole, exposed cable                           | Electricity provider                        | Electrical danger guidance; provider may be outside the municipality.                    |
| Waste and cleanliness               | Missed collection, illegal dumping, overflowing public bin            | Waste services                              | Optional collection-day prompt.                                                          |
| Parks and public spaces             | Damaged playground, fallen tree, overgrown public area                | Parks / environment                         | Capture specific public asset or landmark.                                               |
| Public facilities                   | Damaged public toilet, shelter, community facility                    | Facilities management                       | Public facilities only; no private-home allegations.                                     |
| Dangerous infrastructure            | Open manhole, sinkhole, damaged bridge, unstable public structure     | Engineering / relevant authority            | Immediate-danger screen and priority review.                                             |
| Crash / road obstruction            | Crash affecting the road, debris, blocked lane, abandoned obstruction | Relevant road authority / emergency service | Emergency guidance first; no victim details or graphic photos; temporary map visibility. |
| Other municipal issue               | Issue outside the configured categories                               | General triage                              | Require a useful description; staff reclassifies.                                        |

For a focused pilot, enable roads, traffic lights, sewer, water, stormwater, waste, streetlights, and other first. Enable crash reporting only after local emergency guidance and a review/expiry process are configured. Category ownership must be agreed locally; not every service is operated by a municipality.

## 4. Resident app design

### Navigation

Use three main tabs: **Nearby**, **Report**, and **My reports**. Help, privacy, notification preferences, data deletion, and the tracking explanation live in a small settings/help screen. Use native iOS and Android navigation patterns.

| Screen                 | Main content and actions                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Nearby                 | Map/list switch, area selector, category/status filters, clustered incident pins, selected-incident sheet, report button.      |
| Report: category       | Searchable category tiles, relevant safety guidance, short step indicator.                                                     |
| Report: location       | Use current location, move pin to issue, enter landmark; address is a convenience, confirmed pin is the issue location.        |
| Report: details        | Short description, optional photos, incident time if different from now, category-specific prompts.                            |
| Report: nearby matches | Suggest nearby related incidents; choose 'Add my report to this issue' or continue with a separate issue.                      |
| Report: review         | Category, location, description, images, visibility explanation, required community-policy acceptance, submit.                 |
| Receipt                | Server-confirmed reference, 'Awaiting review', tracking explanation, optional notification request.                            |
| My reports             | Active / resolved / drafts filters; private report cards, queue/error states, last update and linked incident progress.        |
| My report detail       | Own submitted information, moderation result, reviewed public progress, submitted updates, add evidence or request correction. |
| Public incident detail | Approved summary, location, dates, public timeline, count of approved reporting installations, abuse-report action.            |

### Reporting flow

1. Open the app with no registration screen. Browse without requesting permissions.
2. Tap Report and choose a category.
3. If a category indicates immediate danger, show a prominent configured emergency-call action and explain that submitting does not contact emergency services.
4. Request foreground location only when the resident taps 'Use my location'. They can decline and place the issue manually.
5. Confirm the actual issue location. Capture accuracy and location source; let the resident correct GPS errors.
6. Enter a short description; optionally add up to three images. Avoid names, faces, number plates, private documents, and graphic content.
7. When online, suggest related nearby incidents. Matching is advisory, never a reason to reject a valid report.
8. Review and accept community rules before the first contribution; retain the accepted policy version and acceptance timestamp.
9. Save/queue locally when offline. Only display 'Report received' and issue a public reference after server acknowledgement.
10. Show the private receipt immediately after acknowledgement. Public publication waits for review.

**Proposed form limits:** description 10-1,000 characters, maximum three photos, client target around 1 MB per compressed image, hard server limit 5 MB per uploaded image. Photo submission is optional. All limits are configurable and validated on the server.

### Design direction

- Calm civic visual identity: deep navy for navigation, teal for primary actions, pale neutral backgrounds, generous spacing.
- Use category icons on map pins; use a separate status label and marker ring so category, workflow, and urgency are not confused.
- Every status has text and an icon; never rely only on red/green.
- Large tap targets (at least 44 pt on iOS / 48 dp on Android), readable contrast, dynamic text, screen-reader labels, keyboard-safe forms.
- Native sheets and controls through `@expo/ui` where supported by the selected Expo SDK; virtualized lists for growing report feeds.
- Provide a list equivalent to every map-based task. Maps, photos, and geocoding must not be prerequisites for submitting a text report.
- Every data screen has loading, empty, error, stale/offline, and content states. Drafts survive navigation and process termination.

## 5. Tracking without visible sign-in

### Ownership model

- Firebase Auth maintains the anonymous resident UID using native persistence. Wait for auth restoration before deciding whether to create a new anonymous identity; do not sign in anew on every launch.
- `ownerUid` on each report is written by the server from verified authentication, never trusted from request JSON.
- An installation UUID is optional telemetry/context, not an authentication credential, hardware fingerprint, or proof of ownership.
- My reports queries only reports owned by the authenticated UID. Shared devices naturally share this app history; explain that behavior.
- Do not sign out residents during ordinary navigation. Disabling notifications must not delete their identity or reports.
- Leave automatic anonymous-account cleanup disabled. Firebase's optional Identity Platform cleanup can remove anonymous accounts after 30 days, which conflicts with long-running report tracking. [S1]

### Persistence and recovery

| Event                                   | Intended behavior                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| Restart / app update                    | Restore the same identity; retrieve reports and cached drafts. Test on both platforms. |
| Offline first launch                    | Allow local drafting without a backend identity; authenticate and submit when online.  |
| Clear app data / uninstall / lost phone | Private editing history may become inaccessible. Do not promise automatic recovery.    |
| Open a shared incident link             | View the approved public incident; this does not import ownership.                     |
| Same person on a new device             | New anonymous identity; cross-device tracking requires the optional recovery feature.  |

SecureStore is suitable for a small optional recovery secret, not the whole report database. Android uninstall removes its data; iOS Keychain behavior must not be relied on as a recovery guarantee. The native Auth SDK owns Firebase credential persistence. [S4]

**MVP wording:** 'Your reports are linked to this app installation. Clearing app data, changing phones, or reinstalling may remove your ability to update them.'

**Later option:** offer an optional high-entropy recovery key for the installation's report history, with no email or password. Store only its cryptographic verifier on the server. Redemption requires a current authenticated session, rate limiting, explicit confirmation, atomic ownership transfer, invalidation of old recovery material, notification-token revocation, and an audit event. A short, public report reference is never a recovery key. This needs its own security design and testing before implementation.

### Resident update permissions

| Action                               | Before initial review                                                         | After acceptance / linkage to incident                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Change description/category/location | Submit a versioned correction for the pending report.                         | Request a correction; preserve original evidence and incident coordinates until staff review. |
| Add photo or observation             | Allowed as a private pending update.                                          | Allowed; new material stays private until approved.                                           |
| Say 'It is fixed'                    | Add an observation.                                                           | Submit a resolution observation; staff confirms workflow changes.                             |
| Say 'Still not fixed'                | Add an observation.                                                           | Request reopening with evidence; do not directly reopen the incident.                         |
| Withdraw submission                  | Withdraw the resident contribution and stop publication of that contribution. | Same, but the incident may remain if other reports or service records support it.             |
| Assign priority/team or mark closed  | Not permitted.                                                                | Not permitted.                                                                                |

Re-review changed material. An unreviewed correction must never silently overwrite previously published content.

## 6. Public website

The public site is a useful civic data product in its own right. Its primary job is to answer: **Which reported problems in this area still need action, and what evidence explains what happened?** Residents should benefit without installing an app or signing in.

### Public information architecture

| Route / view         | Main purpose                             | MVP content                                                                                                                                  |
| -------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/explore`           | Discover and inspect issues              | Linked map/list, place/category/progress/date filters, issue/evidence age, sharing and safe details.                                         |
| `/issues/:reference` | Inspect one public record                | Stable incident reference, approved evidence, reviewed history, handoff and resolution provenance, corrections and abuse reporting.          |
| `/areas/:areaId`     | Understand the local dataset             | Scoped open/resolved counts, observation freshness, category breakdown, coverage start and participation caveats. No authority league table. |
| `/data`              | Reuse reviewed metadata                  | Bounded CSV download, snapshot/as-of time, field definitions, scope, update schedule, correction/removal policy and agreed reuse terms.      |
| `/methodology`       | Understand what the labels mean          | Review versus inspection, evidence types, handoffs, resolution, deduplication, coverage, exclusions and uncertainty.                         |
| `/about` and `/help` | Identify the operator and get assistance | Independent/official status, review hours, support contact, community/privacy policies and safe app reporting guidance.                      |

The public portal's redesigned direction uses the explicitly requested `design-taste-frontend` skill, with its **app-screen** workflow because people explore and compare records here. Selected style: **Achromatic ledger**, seed **879817**. Neutral navigation and actions; pale blue-grey ground; white flat data surfaces; original teal reserved for unresolved map data. Keep the original blueprint's Segoe UI face. No decorative KPI tiles, saturated sidebar, gradients, glass, fake growth claims or invented authority partnerships. The mobile app and ops workflow retain their functional baseline; this art-direction change is scoped to the public portal.

Use a desktop linked register/map layout with a selected incident panel. Open-plane labelled navigation contains Explore issues, Area summaries, Public data and How evidence works. On phones, navigation folds into a menu and the map/list occupies one region at a time; selecting a row opens the detail view and Back restores list/filter state. Controls have readable labels, visible focus, 44px touch targets and a list equivalent for map tasks. Do not bury the register behind an animated marketing introduction.

**MVP features:** area/ward selection; category, workflow status and date filters; reference and landmark search; map clustering; accessible list; public incident details and history; approved thumbnails; evidence freshness and handoff provenance; shareable filter URLs; area summaries with denominators/coverage; bounded public metadata CSV; abuse/source-hiding controls; operator/help details; last-refresh/as-of timestamps. Record all numbers from one scoped dataset/query contract so pins, rows, counts and downloads agree.

Only expose a server-built allowlisted projection in `publicIncidents` and approved public-event records. The public API reads this projection. Do not send private documents and hide fields in the browser. Firestore access rules operate at document level, and server SDK access bypasses those rules; API authorization and response schemas are mandatory. [S8]

Public fields: incident reference, reviewed title/summary, category, area/ward, approved issue coordinates or generalized point, workflow status, approved image references, approved reporting-installation count, received/updated timestamps, and a public timeline.

Add public evidence fields: `firstAcceptedAt`, `lastApprovedEvidenceAt`, `evidenceType`, `evidenceSourceClass`, `handoffStatus`, `handoffEvidenceAt`, `resolutionEvidenceClass`, `resolutionEvidenceAt`, `locationPrecision`, `publicationVersion`, `coverageId` and `snapshotAsOf`. Do not publish personal observer identity. Administrative edits change `updatedAt` but must not reset evidence age. A resolution observation, an authority statement and an independent field check have distinct labels; absent evidence remains unknown.

Never publish reporter UID, installation ID, IP/risk data, contact details, push tokens, recovery verifiers, raw upload paths, internal notes, staff email addresses, or unreviewed attachments. Precise public-infrastructure locations can be useful; sensitive locations must be hidden or generalized during review. Store only the issue location, not a history of resident movements.

**Accuracy labels:** 'Community reported' and 'Reviewed for publication' do not assert physical inspection. Show 'Municipality notified' only after a real handoff, and 'Acknowledged by municipality' only with evidence of acknowledgement. If independent, display the platform's independent status and published review hours clearly.

**MVP search scope:** exact reference, structured area/category filters, and normalized landmark prefixes. Full-text/fuzzy search is a later search-service integration; do not pretend Firestore provides arbitrary full-text search.

## 7. Operations dashboard

| Module               | MVP capabilities                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Overview             | New submissions, unpublished backlog, open incidents, priority incidents, overdue work, counts by ward/category.                                       |
| Moderation inbox     | Review text/photos/location, approve, reject with reason, request clarification, redact, hide abusive content.                                         |
| Incidents            | Map and paginated table, filters, detail workspace, category correction, responsible service, priority, assignee, progress.                            |
| Duplicate management | Suggest nearby matches; link reports or merge incidents with reason and audit trail.                                                                   |
| Work management      | Assign to team, set locally agreed target, record internal notes, approved public updates, and resolution evidence.                                    |
| Reopen / disputes    | Review resident 'still unresolved' updates, reopen with reason, preserve prior closure history.                                                        |
| Handoffs             | Record department/provider contact, ticket reference, delivery evidence, acknowledgement and failures. No automatic send without a configured channel. |
| Reports and export   | Date/ward/category/department summaries; scoped CSV export with an audit event and private fields excluded by default.                                 |
| Administration       | Categories, teams, wards, service boundaries, public safety copy, published hours, staff access and role revocation.                                   |
| Audit and abuse      | Who changed what and why; blocked contributors; content reports; sensitive export and role-change events.                                              |

### Roles

| Role                        | Scope                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Moderator / triage operator | Review, redact, classify, link reports; no staff administration.                              |
| Dispatcher / supervisor     | Route work, assign priority, manage merges, approve closure/reopening within municipality.    |
| Service-team member         | View and update assigned/scoped incidents; no unrelated private reports.                      |
| Analyst / read-only manager | Aggregate reporting and approved views; export only if separately granted.                    |
| Municipality administrator  | Manage local configuration, teams and staff membership.                                       |
| Platform administrator      | Explicit cross-municipality operations; strong authentication and audited privileged actions. |

Small pilots can combine roles on one named staff account. Keep the permissions separate in code. Staff use strong authentication; enable MFA with the chosen supported provider before production. All staff mutations check active membership and municipality scope server-side, including when custom claims are cached.

## 8. Lifecycles and data management

Keep these three states independent:

| Axis                 | States                                                                                                         | Meaning                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Report moderation    | `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN`                                                                 | Whether this resident's contribution is accepted.  |
| Incident workflow    | `RECEIVED`, `ACKNOWLEDGED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`; branches `OUT_OF_SCOPE`, `MERGED` | Service work on the real-world issue.              |
| Incident publication | `HIDDEN`, `PUBLISHED`                                                                                          | Whether the reviewed incident is publicly visible. |

`ACKNOWLEDGED` means the platform has reviewed/accepted the issue, unless an official operating agreement explicitly makes staff the municipality's agents. External handoff state remains separate: `NOT_SENT`, `SENT`, `ACKNOWLEDGED`, `FAILED`.

Normal progression: received -> acknowledged -> assigned -> in progress -> resolved -> closed. A supervisor may reopen resolved/closed work to acknowledged with a reason; rejected reports are corrected/resubmitted through moderation rather than treated as incident workflow states. Out-of-scope issues receive a transparent explanation and configured referral. Draft, uploading, and queued are local submission states, not incident statuses.

Each transition is a server command with expected version, role/scope check, allowed-transition check, timestamp, reason where required, and a timeline/audit event. Do not expose a generic arbitrary-document update endpoint.

### Duplicate handling

- Suggest candidate incidents using category family, distance, age, status, and landmark. Proposed pilot radii: around 50 m for point assets and 100-200 m for road/water issues; tune after field testing.
- Resident suggestions use only already-public incidents. Staff also sees private candidates.
- A matching suggestion is not proof of a duplicate. Staff decides; nearby intersections can have separate faults.
- Approval either creates a hidden incident or links to an existing one. Publication is a distinct reviewed action and may be included atomically in the same approved command.
- Preserve each report, its owner, and receipt when linking. Their tracking view resolves to the canonical incident.
- For an incident merge, select a canonical incident, reject cycles, record `mergedIntoId` on the source, keep aliases/redirects for public links, and migrate report links/events through a retryable job.
- Hide the source pin immediately and prevent edits to the merged record. Until migration finishes, reads resolve through the canonical incident; clients must not depend on every report being moved in one Firestore batch.
- Count distinct approved, active reporting UIDs per canonical incident; make count updates idempotent. This is a count of installations/anonymous identities, not verified people. Scheduled reconciliation repairs drift.

### Priority and freshness

Residents indicate observable danger; staff assigns final priority. Suggested labels are critical, high, normal and low. Configure response targets by category and service agreement; do not publish invented repair promises. Show age and last update. Temporary road obstructions/crashes need an `expiresAt`, default two-hour public review/expiry window as a proposed pilot setting; expiration hides the alert and does not claim the road is safe or delete the record.

## 9. Technical architecture

### Stack decisions

| Layer            | Proposed choice                                          | Reason                                                                                                                        |
| ---------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Mobile           | React Native, Expo, TypeScript, Expo Router              | Shared iOS/Android application and native navigation.                                                                         |
| Mobile Firebase  | `@react-native-firebase` modules                         | Native Auth, Firestore, Storage, Functions, App Check and Crashlytics. Requires a development build rather than Expo Go. [S2] |
| Mobile maps      | `react-native-maps`, Google provider on both platforms   | Uses the existing Google Maps investment; iOS and Android require separate platform setup. [S5]                               |
| Location/media   | Expo Location, ImagePicker, ImageManipulator, FileSystem | Foreground coordinates, optional photos, compression and persistent draft media.                                              |
| Local state      | SQLite for drafts/outbox; small preferences separately   | Durable state for submissions that must survive restarts.                                                                     |
| Push             | Expo Notifications + Expo Push Service                   | One selected push path, using APNs/FCM underneath; store delivery tokens privately and process receipts.                      |
| Web              | Two React + TypeScript + Vite apps                       | Independent public and ops interfaces with shared domain types; straightforward static hosting.                               |
| Web maps         | Google Maps JavaScript API                               | Separate browser key with domain/API restrictions.                                                                            |
| Hosting          | Firebase Hosting with public/ops targets                 | Static apps, custom domains, and API rewrites. SSR/SEO rendering can be added later.                                          |
| Backend          | Cloud Functions for Firebase, 2nd gen, TypeScript        | Validated commands, public queries, media processing, scheduled maintenance.                                                  |
| Database         | Cloud Firestore Standard                                 | Operational reports, incidents, configuration, events, projections.                                                           |
| Media            | Cloud Storage for Firebase                               | Private uploads and separately approved public derivatives.                                                                   |
| Access and abuse | Firebase Auth, App Check, server limits, Security Rules  | Ownership, staff access, app attestation, quotas and access boundaries.                                                       |
| Operations       | Crashlytics, Cloud Logging/Monitoring, scheduled backups | Reliability, queue alerts, service diagnostics and recovery.                                                                  |

Select the current supported stable Expo SDK at kickoff, verify the native Firebase/maps/UI combination in a small spike, and lock dependencies. No SDK version is assumed in this plan. Install Expo-compatible packages with `npx expo install`. Treat the first real-device development builds as a dependency gate before feature implementation.

### Data paths

1. Mobile reads its own report data through narrowly scoped Firestore rules and receives bounded listeners while relevant screens are open.
2. Mobile sends commands through callable Functions, carrying anonymous Auth and App Check tokens. Callables support token propagation/validation, but handlers must still check authorization and validate payloads. [S7]
3. Storage rules allow only owner-scoped, ticket-authorized private uploads. Backend jobs validate and process media.
4. Staff uses named Firebase Auth and server commands for every business mutation. Direct Firestore reads are permitted only for explicitly scoped views.
5. Public mobile/web queries go through a bounded, cached HTTP API reading allowlisted public projections. Deny unauthenticated direct access to private Firestore collections and private Storage paths.
6. Commands write business data, append-only application audit events and outbox entries in one transaction. Retryable workers update public projections, counters and notifications after commit.

Use a monorepo with `apps/mobile`, `apps/public-web`, `apps/ops-web`, `functions`, `packages/domain`, and `firebase` configuration/rules/indexes. Share enums, request/response schemas and validators; do not force native and web components into one rendering layer.

## 10. Proposed data model

Use random document IDs for storage and non-secret human references for display, such as `RPT-2026-7K3M9Q` and `ISS-2026-8N4P2R`. Allocate references server-side with collision checks. Store all timestamps in UTC and display local time. Municipality IDs exist on all scoped records from day one.

| Collection                                        | Important fields / purpose                                                                                                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `residentProfiles/{uid}`                          | Created/last-seen times, policy acceptance, blocked status, optional recovery verifier reference; no mandatory personal profile.                                                                   |
| `residentProfiles/{uid}/notificationDevices/{id}` | Private Expo push token, platform, consent, token status and last-seen time.                                                                                                                       |
| `reports/{id}`                                    | Reference, `ownerUid`, municipalityId, categoryId, submitted location, description, moderationStatus, nullable incidentId, source, observedAt, receivedAt, version, withdrawal state.              |
| `reports/{id}/revisions/{id}`                     | Prior submitted values, correction/update type, approval state, authoredAt, appliedAt. Owner-safe content only.                                                                                    |
| `incidents/{id}`                                  | Canonical reviewed issue, municipality/ward/service, workflowStatus, publicationStatus, priority, assignee, reviewed location/geohash, timestamps, targetAt, version, mergedIntoId, expiresAt.     |
| `incidentEvents/{id}`                             | Internal timeline with actor, reason, transition, related report IDs and visibility classification. Never directly public.                                                                         |
| `publicIncidents/{id}`                            | Explicitly allowlisted snapshot; no owner, contact, internal note, or original media fields. Accessible through public API only.                                                                   |
| `publicIncidentEvents/{id}`                       | Separate approved public timeline with non-sensitive attribution.                                                                                                                                  |
| `incidentContributors/{incidentId_uid}`           | Membership state for approved reporting identity; supports idempotent distinct-installation counts.                                                                                                |
| `mediaAssets/{id}`                                | Owner/report link, private object path, content hash, decoded metadata, validation status, moderation status, public derivative ID.                                                                |
| `uploadTickets/{id}`                              | Owner, allowed immutable object paths, size/count limits, expiry, consumed state.                                                                                                                  |
| `abuseReports/{id}`                               | Target public content, reason, reporter identity if supplied by app, moderation outcome.                                                                                                           |
| `staffMemberships/{uid_municipalityId}`           | Role/permission set, team IDs, active/revoked state; authoritative server-side scope.                                                                                                              |
| `municipalities/{id}`                             | Boundary, timezone, active categories, service routing, verified emergency/support contacts, published review hours.                                                                               |
| `categories`, `departments`, `wards`              | Versioned municipality-scoped configuration; ward boundary mapping server-side.                                                                                                                    |
| `commandReceipts/{uid_operationId}`               | Idempotency key, command type, request hash, committed result and retention.                                                                                                                       |
| `outboxJobs/{id}`                                 | Projection/push/merge/counter tasks, attempts, nextAttemptAt, state and failure information.                                                                                                       |
| `auditEvents/{id}`                                | Actor/scope, action, entity/version, safe before/after summary, reason and request ID; no secrets or photo payloads.                                                                               |
| `dailyMetrics/{scope_date}`                       | Reconciled aggregate counts, durations, queue age, job failures and operational metrics.                                                                                                           |
| `publicAreaMetrics/{scope_snapshot}`              | Approved public counts by area/category/cohort, denominator, evidence freshness, coverage status and as-of time. No private metrics leaked from dailyMetrics.                                      |
| `publicDataSnapshots/{id}`                        | Schema version, approved filter scope, generatedAt/asOf, public column allowlist, row count, checksum, expiry/superseded state and publication version; private export object path is server-only. |
| `publicRevisions/{incidentId_version}`            | Safe public history of category/location/status/evidence corrections; excludes deleted personal data and private original text.                                                                    |

Keep staff-only risk signals and moderation notes outside owner-readable report documents. Do not place secret fields in a document readable by residents and rely on UI hiding. Audit is append-only to application clients; privileged backend administrators can still change the database. If stronger retention/immutability is required, export to a separately controlled log sink/storage policy.

### Example report versus incident

| Field       | Resident report                              | Canonical incident                                         |
| ----------- | -------------------------------------------- | ---------------------------------------------------------- |
| Identity    | RPT-2026-7K3M9Q                              | ISS-2026-8N4P2R                                            |
| Ownership   | Anonymous `ownerUid`                         | Responsible service/team                                   |
| Location    | Resident's original submitted point          | Staff-reviewed operational/public point                    |
| Description | Original evidence plus versioned corrections | Reviewed summary suitable for publication                  |
| Status      | Pending / approved / rejected / withdrawn    | Acknowledged / assigned / in progress / resolved / closed  |
| Access      | Owner and authorized staff                   | Private operational record plus separate public projection |

### Query/index plan

- My reports: `ownerUid + receivedAt DESC`; optionally owner + moderation status + received time.
- Moderation inbox: `municipalityId + moderationStatus + receivedAt ASC`.
- Operations queue: municipality + workflow status + updatedAt; municipality + departmentId + status + targetAt; municipality + assigneeUid + status + updatedAt as actual screens require.
- Candidate/public map: municipality + publication/status/category constraints + geohash ranges; apply exact geometry filtering after the range query.
- Public list: municipality + workflow status + updatedAt, with cursor pagination.
- Events: incidentId + timestamp; uploads/jobs: state + expiry/nextAttemptAt.
- Commit required composite indexes alongside each query. Do not create every possible combination speculatively.
- Disable indexing of large descriptions, audit diffs, and media metadata fields unless a query needs them.

## 11. Backend commands, consistency and media

| Command / endpoint                      | Actor                  | Key behavior                                                                                                                                                       |
| --------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `beginReportUpload`                     | Resident               | Issue short-lived upload ticket after limits/auth/attestation checks.                                                                                              |
| `createReport`                          | Resident               | Validate ticket/assets, set owner from token, issue reference, write report + receipt + audit/outbox atomically.                                                   |
| `correctPendingReport`                  | Owner                  | Version check, keep revision history, requeue moderation.                                                                                                          |
| `addReportUpdate`                       | Owner                  | Append evidence/correction/resolution/reopen request; never directly publish or change incident status.                                                            |
| `withdrawReport`                        | Owner                  | Remove contribution from review/public support; recompute canonical incident effects.                                                                              |
| `registerNotificationDevice`            | Resident               | Record token and consent privately; support token rotation and removal.                                                                                            |
| `requestDataDeletion`                   | Resident               | Queue deletion/anonymization under the published retention policy; remove tokens and private uploads as appropriate.                                               |
| `reviewReport`                          | Authorized staff       | Approve/reject with reason; link or create incident; enforce municipality scope.                                                                                   |
| `publishIncident` / `hideIncident`      | Moderator / supervisor | Approve allowlisted content; revoke projection/assets on hide.                                                                                                     |
| `assignIncident` / `transitionIncident` | Scoped staff           | Enforce role, version, workflow, reason, evidence and assignment rules.                                                                                            |
| `mergeIncidents`                        | Supervisor             | Canonical selection, cycle prevention, source hiding, audited retryable migration.                                                                                 |
| `recordExternalHandoff`                 | Dispatcher             | Store actual delivery/acknowledgement evidence, provider and external reference.                                                                                   |
| `reportPublicContent`                   | Visitor / resident     | Rate-limited content report; anonymous web input gets abuse controls.                                                                                              |
| `GET /api/public/incidents`             | Anyone                 | Bounded map/list queries, allowlisted fields, cache and truncation/cursor metadata.                                                                                |
| `GET /api/public/incidents/:ref`        | Anyone                 | Approved details/events only; handle merged/hidden/expired records.                                                                                                |
| `GET /api/public/areas/:id`             | Anyone                 | Approved aggregate with explicit scope, denominator, coverage and as-of time.                                                                                      |
| `GET /api/public/data`                  | Anyone                 | Allowlisted, bounded public CSV/snapshot access; rate-limited and publication-version checked. Never reuse the staff export implementation or its private columns. |
| `exportIncidents`                       | Authorized staff       | Explicit column allowlist, scoped async generation, short-lived access and audit event.                                                                            |

### Idempotency and conflicts

Every create/update action has a client-generated operation UUID persisted before sending. Server idempotency is scoped by authenticated UID + operation ID. In one transaction, check the receipt and payload hash, validate the current version, apply the command, append the audit/event, and persist the response. A retry returns the committed response; reuse with a different payload returns a conflict. Outbox tasks use deterministic IDs and idempotent side effects. Never send push notifications or call external services from inside a Firestore transaction callback.

Use `expectedVersion` on staff/resident corrections. A stale edit returns the latest version and a recoverable conflict message. Media processing, large merges and projections are eventually consistent; show pending states and queue age. A scheduled reconciler repairs missing projections/counters and alerts on stuck jobs. Retain compact create-command receipts for the life of the report; make other retry windows explicit (proposed 30 days) and reject stale replay rather than accidentally recreating old actions.

### Media pipeline

1. Resize/compress on device; retain draft media in persistent app storage until the server confirms receipt.
2. Request an upload ticket; use immutable owner-scoped object paths. Storage rules check ownership, ticket, count/path, declared type, size and expiry.
3. Backend decodes actual bytes, verifies format/size/dimensions, rejects malformed or unsupported files, strips metadata including EXIF location, and creates thumbnails.
4. Quarantine all raw material privately. A failed photo must not produce a false successful attachment; let residents retry, remove it, or explicitly submit without it.
5. Staff approves or redacts selected media. Face/number-plate blurring can be manual initially; automated detection is a later aid, not a guarantee.
6. Publish only sanitized derivatives with non-identifying object paths. Do not reuse permanent tokenized private download URLs as public image URLs.
7. On rejection/withdrawal/hide, remove public references and purge or expire public derivatives/caches under a defined short revocation window. Already downloaded public images cannot be recalled.
8. Expire abandoned upload tickets and orphaned private uploads with a scheduled job. Proposed orphan cleanup after 24 hours; retryable drafts request new tickets.

## 12. Maps and scale

Google Maps supplies the basemap. Your Firebase data supplies incident markers, status, category and timelines. Configure separate restricted keys for Android, iOS, browser, and any server-side geocoding. Android signing certificate restrictions must cover the actual Play app signing identity as well as approved development builds; iOS uses bundle restrictions and web uses allowed referrers. A client maps key is not a backend secret. Server keys and service-account credentials stay server-side. [S5][S6]

Store reviewed coordinates as GeoPoint plus a geohash. For the Standard-edition MVP, query bounded geohash ranges, merge/de-duplicate results, then perform exact viewport/radius filtering. Geohash queries can return false positives and increase reads; do not assume a GeoPoint field alone supports radius querying. [S3]

**Proposed pilot limits:** map requests are debounced after movement, cached for 30-60 seconds, limited to one configured municipality and a bounded viewport, and return at most 500 incident points with `truncated=true` when necessary. Show 'Zoom in to see all issues' rather than implying the subset is complete. Cluster returned points on the client; cluster labels describe the returned set, not a city-wide exact count. Public statistics come from aggregates. At greater density, add precomputed map cells/tiles and cluster totals before increasing limits.

Use pagination on public/ops lists, attach mobile owner listeners only to bounded active screens, and avoid a live listener over the whole city's incident collection. Reuse approved coordinates when address lookup fails. Manual pin/landmark entry must work without geocoding. Do not promise an offline basemap or unrestricted map-tile caching.

## 13. Security, privacy and moderation

### Access matrix

| Resource / action               | Public visitor           | Anonymous resident          | Scoped staff                            |
| ------------------------------- | ------------------------ | --------------------------- | --------------------------------------- |
| Public incident API             | Read                     | Read                        | Read                                    |
| Private report                  | No                       | Own only                    | Only authorized municipality/team scope |
| Raw photo                       | No                       | Own authorized report asset | Authorized review/service scope         |
| Create/update report            | No web submission in MVP | Server commands, own data   | Separate audited staff process          |
| Incident status / assignment    | No                       | Request only                | Permission-checked server command       |
| Publish / merge / export        | No                       | No                          | Separate explicit permissions           |
| Recovery verifier / push token  | No                       | No raw read needed          | No ordinary staff access                |
| Staff membership / role changes | No                       | No                          | Authorized administrator only           |

Use deny-by-default Firestore and Storage rules. Reject direct client writes to workflow, moderation, projections, audit, counters and role data. Test rules with the Emulator Suite. Server Admin SDKs bypass client rules, so every handler must enforce the same ownership/scope constraints explicitly. [S8]

App Check should use an appropriate native attestation provider (App Attest/DeviceCheck strategy on Apple platforms and Play Integrity on Android) and a supported web provider where used. Validate it on store-distributed builds before enforcement. It supplements Auth and rate limits; it does not eliminate abuse. Protect public endpoints with caching, bounded queries and server-side abuse controls. [S9]

Proposed initial limits: five new reports per installation/UID per hour and twenty per day, with separate upload/update/abuse-report limits and support overrides. Tune from pilot evidence. Anonymous users can reinstall or create new identities; combine attestation, short-retention network/risk signals, quotas, moderation and server blocking. Do not call this one-person-one-vote.

### Publication and content controls

- Community terms accepted before contributing, privacy policy, public support contact, objectionable-content filtering, human review and a visible report-content action.
- Backend ability to block abusive contributor identities; for public content views, add a user-level 'Hide contributions from this source' action backed by a non-identifying source alias. No public profile or direct messaging is needed. Complete the store-policy fit review against the final content model.
- No raw submissions, identifying images, victim details, or staff notes on the public map. Redact private addresses/contact data if someone puts them in a description.
- Public updates are separately reviewed. Ops must respond to content complaints and urgent-risk triage within published operating arrangements.
- Apple and Google Play publish specific user-generated-content requirements; account for these during design and submission. [S10][S11]

### Data lifecycle

The launch jurisdiction and operating organization determine the applicable privacy obligations; confirm them before production. Collect only issue coordinates, submitted text/media, timestamps, anonymous ownership, policy acceptance, and optional notification token by default. Contact capture is deferred unless an operational need is approved.

Settings includes 'Delete my app data' with clear consequences. The server removes/deactivates identity-linked private data and tokens, handles photos and revisions under the policy, and anonymizes incident provenance where legitimate retained public-service records must remain. Explain retained records and retention periods. Revoke publication where required; do not just delete local storage.

Proposed retention defaults to discuss, not legal conclusions: abandoned uploads 24 hours; temporary abuse/network signals 30 days; inactive notification tokens removed after validation failures; rejected raw photos deleted after a short appeal window; incident/audit retention agreed with the operating authority. Backups and exports need corresponding access/expiry policies. Avoid retaining personal data inside immutable audit summaries.

## 14. Offline and notification behavior

Maintain a SQLite outbox because callable network commands do not become durable offline submissions automatically. Store a draft UUID, operation IDs, dependent report ID, photo file references, expected version, state, attempt count and last error.

Local states: `DRAFT`, `QUEUED`, `UPLOADING`, `SENDING`, `SUBMITTED`, `NEEDS_ATTENTION`. Retry with backoff and jitter when connectivity returns and the app resumes. OS background work is best effort; tell the resident to reopen the app if a queued report has not sent. Never promise guaranteed background delivery.

If a command response is lost after server commit, retry the same operation ID. If authentication is unavailable, leave the queue intact. If the identity changes, do not silently attribute old owner-dependent updates to a different UID. Require recovery or show a clear non-retryable ownership issue.

Ask for push permission after a successful report or when enabling updates, rather than at first launch. Push is optional. Send on review results, meaningful workflow changes, requests for clarification and approved reopening decisions. Lock-screen messages should avoid sensitive descriptions and precise private locations. Deep links open the correct view after an ownership check; unauthorized users see only the public incident. Process delivery receipts, expire invalid tokens and use idempotent delivery jobs. In-app history is authoritative if push delivery fails.

## 15. MVP boundary and later releases

| MVP / pilot                                                                                                              | Later                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| iOS/Android app, silent ownership, persistent drafts, photos, manual/GPS location                                        | Browser reporting, additional languages, optional recovery key                                |
| My reports, reviewed update/correction/reopen requests                                                                   | Optional account linking if the product later needs cross-device convenience                  |
| Reviewed public map/list/detail, evidence history, area summaries, bounded metadata CSV, methodology and abuse reporting | Full-text search, GeoJSON/API access at scale, precomputed heatmaps/tiles, area subscriptions |
| Named-staff dashboard, moderation, duplicate linking/merge, assignment and status                                        | Native field-team app, scheduling, work orders and contractor integration                     |
| Audit, scoped exports, basic analytics, push updates                                                                     | BigQuery/BI, cost/repeat-fault analysis, predictive maintenance                               |
| Recorded handoffs and configured contacts                                                                                | Authorized municipal ticket-system integration, email/SMS/WhatsApp adapters                   |
| Manual review, image sanitation and redaction                                                                            | AI category/duplicate suggestions with human approval                                         |

Do not include social feeds, public chat, payments, AI auto-publication, continuous resident location tracking, or automated emergency dispatch in the initial product.

## 16. Delivery roadmap

**Planning estimate, revised for version 2:** provision roughly 13-14 engineering weeks for two experienced developers with part-time design/QA and a product/operations owner. The original 12-week baseline grows by an estimated 1-2 weeks for public evidence provenance, area methodology and safe data publication; validate this in ticket estimation. A single developer should provision roughly 20-26 weeks. These are estimates, not commitments; store review and partnership approvals add external time. Rich analytics, GeoJSON, a developer API and public historical bulk exports remain later scope.

| Phase                          | Indicative timing            | Concrete deliverables                                                                                                                                                              | Exit gate                                                                                                                      |
| ------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0. Product and operating model | Week 1                       | Pilot boundary, service owners, official/independent wording, categories, emergency/support contacts, UI flows and review policy                                                   | Named operator and approved scope; no ambiguous promise of service delivery.                                                   |
| 1. Foundation and risk spike   | Weeks 2-3                    | Monorepo, dev/staging/prod Firebase projects, billing, Expo builds, native Auth restoration, maps on both stores' build paths, App Check, private upload spike, rules/test harness | Restart ownership, private media, attestation and release-signed maps work on physical iOS/Android devices.                    |
| 2. Resident vertical slice     | Weeks 4-6                    | Reporting wizard, drafts/outbox, compressed media, idempotent create, My reports, corrections/updates, owner timeline                                                              | Offline/restart/timeout retries produce exactly one received report; another UID cannot access it.                             |
| 3. Operations workflow         | Weeks 7-8                    | Staff auth/scope, moderation, incident creation/linking, publication, assignment/status, merge job, audit, push                                                                    | Reviewed report reaches one canonical incident; permissions and stale-edit conflicts are enforced.                             |
| 4. Public experience           | Weeks 9-10                   | Redesigned register/map/detail, evidence provenance, filters, area summaries, safe CSV snapshots, methodology, abuse reporting                                                     | Private fields absent from API and downloads; counts reconcile; publication/removal, dense-map and phone behavior are correct. |
| 5. Hardening and UAT           | Weeks 11-12                  | Accessibility, real-device failure testing, load profile, moderation runbook, deletion, public snapshot revocation, restore exercise, release metadata                             | Release acceptance checks pass and operations can run the pilot.                                                               |
| 6. Pilot and store rollout     | Weeks 13-14 plus review time | TestFlight, Play testing, residents-association pilot, reviewer instructions, operator training, staged release and feedback triage                                                | Named support, monitored queues/budgets and evidence that residents can find and reuse the public record.                      |

### Recommended implementation order inside each phase

Build each flow across mobile/web, backend, rules and validation before starting the next. For example: submit a text-only issue -> review it in ops -> publish one safe pin -> track its status -> add photos -> add offline replay. Keep feature flags for public publication, categories and any untested integration. Do not begin with a large polished dashboard while ownership and submission reliability remain unproven.

### Handoff-ready epics

1. Project foundation, environments and configuration.
2. Resident identity restoration and data ownership.
3. Report intake, location and category configuration.
4. Drafts, uploads and reliable outbox replay.
5. Report tracking, revisions, observations and privacy deletion.
6. Staff identity, municipality scope and role enforcement.
7. Moderation, redaction and reviewed public projections.
8. Incident workflow, routing, duplicates and merge reconciliation.
9. Public register/map/list, safe evidence history, area summaries, public CSV/data methodology and content reporting.
10. Notifications, metrics, exports, audit and release readiness.

Every implementation ticket should name the user-visible outcome, data/rules changes, command contract, failure cases and acceptance checks. Keep a decision log and update the schema/API reference as the code is implemented.

## 17. Acceptance and release checks

| Scenario                               | Required result                                                                                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New resident launches                  | No sign-in form; browse and local drafting work without premature permission prompts.                                                                                                             |
| Location/camera/push permission denied | Manual text/location submission still works; no report-history loss.                                                                                                                              |
| Restart/app upgrade                    | Same owned reports restore; drafts and photo files survive expected lifecycle events.                                                                                                             |
| Offline create + process termination   | Draft persists; explicit queue state; later replay submits once.                                                                                                                                  |
| Server commits but response is lost    | Same operation ID returns original reference; no duplicate report or count.                                                                                                                       |
| Duplicate reports / merge              | Independent receipts remain; one canonical public pin and valid old links.                                                                                                                        |
| Another resident guesses a report ID   | Cannot read private fields, photos, revisions, or update the report.                                                                                                                              |
| Report owner requests resolution       | Observation reaches review; owner cannot change official incident status.                                                                                                                         |
| Staff works outside assigned scope     | Read/command/export is rejected; revoked access takes effect server-side.                                                                                                                         |
| Two staff members edit concurrently    | Stale version is rejected with a recoverable conflict.                                                                                                                                            |
| Unapproved update/photo                | Private until approval; existing safe public content is not overwritten.                                                                                                                          |
| Public API and media inspection        | No UID, tokens, contact data, raw original URLs, internal notes or hidden content.                                                                                                                |
| Hide / withdrawal / expired road alert | Projections and public media revoke within defined cache window; other valid incident evidence survives.                                                                                          |
| Missing/failed push                    | In-app timeline still shows committed status; invalid tokens are retired.                                                                                                                         |
| Dense viewport                         | Result cap/truncation shown honestly; lists paginate; public counts use correct aggregates.                                                                                                       |
| Public filter, count and CSV           | Same incident scope/as-of definition; collapsed duplicates do not inflate counts; export column allowlist excludes private data.                                                                  |
| Evidence freshness                     | Staff title/assignment edits do not change lastApprovedEvidenceAt; unknown observation times remain unknown.                                                                                      |
| Area with low/no participation         | Coverage/insufficient-evidence state shown; no implied zero faults, automatic council ranking or invented resolution percentage.                                                                  |
| Public snapshot after privacy removal  | Removed fields disappear from current views and downloadable snapshots within the stated revocation window; superseded download links stop working. Already downloaded copies cannot be recalled. |
| Malformed/oversized upload             | Rejected by backend processing and never published; orphan cleanup works.                                                                                                                         |
| Deletion request                       | Server job completes; linked private data/tokens/media handled under retention policy; local state clears afterwards.                                                                             |
| Abuse and privacy complaint            | Resident can report content/hide source; ops can review, remove and block an identity.                                                                                                            |
| Emergency category                     | Local verified guidance shown; no claim of dispatch or guaranteed monitoring.                                                                                                                     |
| Release-signed real devices            | Maps, attestation, uploads and push work on TestFlight and Google Play test builds.                                                                                                               |
| Backup restore                         | Operators restore a staging dataset and validate record/media consistency.                                                                                                                        |

Use unit tests for transition/permission/idempotency logic, Emulator Suite tests for Firestore/Storage rules, command integration tests, web end-to-end tests for moderation/publication, and real-device mobile journeys for lifecycle/maps/media/push/offline. Proposed initial load profile: 25 concurrent submissions and 100 concurrent public map sessions against representative data; agree real targets after pilot sizing. Proposed service targets: no-photo receipt p95 under 3 seconds on a healthy connection, cached viewport p95 under 2 seconds, and queued-job age under 5 minutes during staffed hours. These are engineering acceptance targets to measure, not externally promised service levels.

## 18. Costs and operating plan

Cloud Storage for Firebase currently requires the pay-as-you-go Blaze plan, even though eligible no-cost usage can still apply. Plan billing before photo features are enabled. [S12]

| Cost area             | Main driver                                                   | Control                                                                 |
| --------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Firestore             | Document/index reads, writes, listeners, storage              | Bounded queries, projections, aggregates, index discipline.             |
| Storage and bandwidth | Original photos, thumbnails, public image views               | Compression, derivative sizes, retention and cache strategy.            |
| Functions / jobs      | Commands, media decoding, projection work and scheduled tasks | Idempotency, bounded instances, payload limits and job retries.         |
| Maps / geocoding      | Billable map and lookup services under current terms          | Separate restricted keys, quotas, provider-appropriate cache/use rules. |
| Expo and delivery     | Build plan, update usage and selected service limits          | Separate environments, controlled builds/updates.                       |
| Operations            | Review, service liaison, support, redaction and QA            | Small pilot, clear hours, queue ownership and runbooks.                 |

Do not assume the platform is free because Firebase and Maps have no-cost allowances. Obtain a priced forecast using current calculators after choosing region, usage and image sizes. Budget alerts are notifications, not a universal spending cap; use service quotas, command/upload limits and feature kill switches as well.

**Illustrative sizing, not a price quote:** 5,000 reports/month x two 1 MB photos is about 10 GB of new original uploads per month before thumbnails, backups and retention. 20,000 map sessions x five viewport requests x 100 documents returned is about 10 million document reads without cache reuse; geohash false positives, detail reads and index costs can add to this. This is why bounded cached public APIs matter. Review costs and queue metrics weekly during the pilot.

### Metrics

- Reporting funnel: started, queued, received, failed, median completion time.
- Review health: unpublished queue age, reviewed per day, rejected/withdrawn rate, abuse response time.
- Service health: open incident age, handoff delivery/acknowledgement, first response, resolution duration, reopened rate, target breaches.
- Data quality: duplicate linkage rate, location corrections, stale alerts, repeat faults by area.
- Reliability/cost: crash-free sessions, submission retries, outbox failures, projection lag, read/upload volume and spend.
- Distinguish submissions, canonical incidents and reporting installations in every metric. Never label anonymous IDs as verified residents.

Runbooks must cover urgent-risk triage, unlawful/identifying content, compromised staff access, blocked contributors, failed publication jobs, billing/quota exhaustion, backups/restore and a public-map publication pause. Staff availability and municipal participation are as necessary as the software.

## 19. Decisions to confirm before coding

1. Zimbabwe pilot municipality/service boundary and verified local emergency numbers. Country is confirmed; municipality is not.
2. Independent community platform or official municipal channel; who is authorized to claim work completion?
3. Working name/branding, domain and app bundle/package IDs.
4. Named moderation owner, operating hours, initial service departments and handoff process.
5. Initial categories and which require urgent guidance or short-lived map visibility.
6. Whether optional recovery is needed at launch; baseline is device-linked tracking with a clear limitation.
7. Expected monthly reports/map sessions, budget owner, Firebase region and data/backup retention.
8. Delivery team and pilot schedule. Store-review timing remains outside the engineering estimate.

Recommended next step: approve this baseline, confirm the pilot/operating model, then implement Phase 1's real-device ownership/maps/upload/attestation spike before building the full experience.

## 20. Official technical references

Checked 9 November 2026. Design choices and estimates are proposals; source links verify platform behavior, not the project's operating agreements or local legal obligations. Version-pin Expo documentation after the SDK is selected.

- **[S1] Firebase anonymous authentication and optional account cleanup:** https://firebase.google.com/docs/auth/web/anonymous-auth
- **[S2] Expo Firebase integration and development-build requirement:** https://docs.expo.dev/guides/using-firebase/
- **[S3] Firestore Standard geohash queries and limitations:** https://firebase.google.com/docs/firestore/solutions/geoqueries
- **[S4] Expo SecureStore persistence limitations:** https://docs.expo.dev/versions/latest/sdk/securestore/
- **[S5] Expo react-native-maps and Google Maps platform setup:** https://docs.expo.dev/versions/latest/sdk/map-view/
- **[S6] Google Maps Platform key restrictions:** https://developers.google.com/maps/api-security-best-practices
- **[S7] Firebase callable Functions and authentication tokens:** https://firebase.google.com/docs/functions/callable
- **[S8] Firestore access rules and Admin SDK boundary:** https://firebase.google.com/docs/firestore/security/get-started
- **[S9] Firebase App Check capabilities and limitations:** https://firebase.google.com/docs/app-check
- **[S10] Apple App Review, including user-generated content:** https://developer.apple.com/app-store/review/guidelines/
- **[S11] Google Play user-generated-content policy:** https://support.google.com/googleplay/android-developer/answer/9876937?hl=en
- **[S12] Cloud Storage for Firebase billing requirements:** https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

## 21. Zimbabwe market review and positioning

### What the research supports

There are already Zimbabwean reporting, civic-engagement and road-hazard products. **Public data access is an opportunity to investigate and execute well, not an absence we can assert across the market.** In particular, ZINARA advertises a public pothole map and review-before-publication. CITE's own 2021 launch article says users could track their ticket and other issues. LADS Africa describes public scorecards. These overlap with parts of Civic263's proposed proposition. [Z1][Z2][Z3][Z4]

This was a read-only review of accessible pages on 9 November 2026. No test complaints were submitted, no apps were installed, no operational uptime/data completeness was proven and no operator was contacted. Launch announcements do not establish present availability. A page that could not be fetched is **unverified**, not evidence that a service is closed or has no public information. A map with a loading state is evidence of an advertised public map, not proof of its current dataset size.

| Platform / source                    | What was substantiated                                                                                                                                                          | Public-data conclusion and limits                                                                                                                                                                                                                                                         | Implication for Civic263                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Citizen Engagement / Scoring         | Provider LADS Africa describes citizen surveys, public scorecards and response analytics. Its launch material credits LADS development and acknowledges HIT and other partners. | Root was not readable and `/crm` could not be fetched. A public issue-level map, downloadable incident history, current authority coverage and anonymous CRM behavior were not verified. Do not repeat the supplied 92-authority/HIT-only development claims as confirmed facts. [Z4][Z5] | Distinguish an incident evidence record from a satisfaction survey; test the actual public experience before making comparisons.                      |
| City of Harare issue portal          | Current page offers municipal issue intake and reference tracking; displayed intake requests a full name/contact and an incident photo.                                         | The reviewed page is a submission/reference flow, not evidence of a browse-all incident dataset. No conclusion about all Harare services can be drawn from one page. [Z6]                                                                                                                 | Low-friction mobile reporting plus publicly browsable reviewed records are concrete design differences to validate.                                   |
| TauraHarare                          | CHRA's 21 October 2021 announcement, republished with attribution, describes council/residents-association collaboration and WhatsApp/SMS/Messenger reporting.                  | Historical announcement; current app availability and public data/export access were not tested. The reviewed archive contains unrelated injected-looking text, so treat it as a historical lead and seek fresh operator confirmation. [Z7]                                               | Treat existing channels as potential partners, not an empty market. Do not conflate TauraHarare with a different app listing.                         |
| CITE Fix My City                     | CITE's 2 December 2021 launch article describes reporting, a ticket number, council forwarding and tracking other Bulawayo issues.                                              | Public/shared issue visibility was described historically. A current public browser map, data export and continuing operational coverage remain unverified. [Z3]                                                                                                                          | Accountability is already part of its stated purpose; Civic263 must demonstrate better evidence continuity, discoverability and reuse.                |
| ZIMCODD CitizenApp                   | ZIMCODD's 17 March 2023 press brief confirms picture/narrative/video reports spanning service delivery, public-resource issues and corruption.                                  | Current web-wide public access, structured municipal incident downloads and active app availability were not established. [Z8]                                                                                                                                                            | Keep Civic263's municipal infrastructure scope focused; do not add a corruption/accusations feed.                                                     |
| ZINARA Pothole Tracker               | Operator pages explicitly offer a public pothole map and review before publication; the form offers optional contact details.                                                   | Public location-based reporting is advertised already. The web extraction showed a loading state, not a tested working map or confirmed data export. [Z1][Z2]                                                                                                                             | Public map and anonymous-style reporting alone are insufficient differentiation; multi-service evidence/history and reusable metadata must add value. |
| RoadSAFE Zimbabwe                    | Search-indexed operator feature copy advertises community hazard alerts including potholes and accidents.                                                                       | Page body was not readable during this review. App operation, community-verification process and reusable public municipal records were not verified. [Z9]                                                                                                                                | Navigation/hazard alerts overlap with road use cases; Civic263 centers durable municipal issue records.                                               |
| Instatoll / Zimgeo road-assets claim | The supplied about URL could not be accessed; corroboration of this specific WhatsApp reporting/auto-mapping/fix-notification service was not found in this review.             | Leave the claimed feature set unverified. Evidence that Instatoll operates tolling services is not evidence of this particular product. [Z10]                                                                                                                                             | Exclude the specific claims from public competitor advertising until independently confirmed.                                                         |

### Positioning to adopt

**Product statement:** Civic263 is a public municipal issue register for Zimbabwe: residents report without visible sign-in, while everyone can inspect reviewed evidence, response history and approved data across service categories.

**Public-facing line:** 'See what was reported. See what happened next.'

**Supporting statement:** 'Explore reported municipal issues, inspect the evidence and reuse reviewed public data.'

Market this as a deliverable promise about our product. Do not claim 'Zimbabwe's first', 'the only public map', 'other apps hide all data', nationwide active coverage, a verified resident count, municipal endorsement, or faster repairs without evidence. 'Open data' requires explicit reuse terms and a usable machine-readable dataset; a viewable map alone does not fulfill that promise.

| Audience                  | Useful outcome                                                                                      | Evidence of value to collect during the pilot                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Residents                 | Find whether the same issue is already recorded; see age, evidence and progress without logging in. | Browse-to-detail completion, successful duplicate linkage, comprehension of status/handoff labels. |
| Residents associations    | Maintain a shared issue list and support service discussions with consistent records.               | Repeat use of area views, public snapshots and corrected records.                                  |
| Journalists / researchers | Inspect provenance and reuse a documented dataset without receiving private resident data.          | Correct use of downloaded data; sources and limitations retained in resulting analysis.            |
| Municipal/provider teams  | Receive clear consolidated evidence and record a response without managing duplicate messages.      | Actual handoff acknowledgement, useful evidence quality and reduced duplicate handling.            |

Pilot with one residents association and a named service-contact process. Seed only genuine, permissioned observations collected by the pilot team or residents; label the source and review them normally. Never scrape/import competitor records just to make the map appear populated. External data later requires provenance, permission/reuse checks, deduplication and freshness handling. Keep public browsing and basic reviewed metadata access free in the initial proposition; any future paid workflow/analytics offer must not remove the promised public baseline.

### Validate the opportunity before making comparative claims

Run a structured manual comparison: can a signed-out visitor browse current issues, filter an area/category, open a stable issue URL, inspect evidence and dates, distinguish official acknowledgement, see safe change history, download approved structured data, and understand coverage? Mark each feature observed / operator-described / historical / inaccessible / not assessed, with URL and date. Separately test adoption, continuing operator support and data completeness with the operators where appropriate; do not infer them from promotional pages.

## 22. Public data and evidence contract

### Publication scope

Public means **reviewed incident information**, not all collected data. Private owner history, pending/rejected reports, contributor IDs, contact details, notification tokens, abuse/risk signals, original photos, internal staff notes and precise withheld coordinates remain private. Generalizing a map point must also generalize it in APIs, downloadable files and aggregates. Publish community observations with clear evidence labels; moderation approval is not field verification.

An MVP CSV contains incident reference and stable public link, category, area/ward where reviewed, approved summary, publishable location and precision, workflow state, firstAcceptedAt, lastApprovedEvidenceAt, handoff state/time if evidenced, resolution evidence class/time if available, public revision version, and snapshot as-of time. Exclude photos and media URLs from the default dataset unless separate reuse rights are established. Use ISO timestamps and a versioned data dictionary. Do not include identifiable free text just because a staff view contains it.

Public incidents should show a small number of meaningful labels:

| Label                              | Required evidence                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Reported by a resident             | A received submission; private until publication review.                                                                 |
| Reviewed for publication           | Text/location/media reviewed for public suitability; no implication of a field visit.                                    |
| Sent to responsible service        | Recorded delivery evidence and destination; a staff intention to send is insufficient.                                   |
| Acknowledged by authority/provider | Evidence of acknowledgement or linked external ticket.                                                                   |
| Resolution reported                | Reviewed observation that the problem appears fixed; name the source class, not the private person.                      |
| Resolution checked                 | Evidence of the stated verification method and date; distinguish authority confirmation from an independent field check. |
| Needs fresh evidence               | Latest approved observation exceeds a configured category threshold; not proof the problem persists or is repaired.      |

### Statistics with an honest denominator

- Count canonical incidents separately from submissions and anonymous reporting identities.
- Issue age = as-of time minus first accepted observation for an open incident. Evidence age = as-of time minus latest approved observation; administrative edits do not reset it.
- For any resolved percentage, state the cohort (for example, all published incidents first accepted in a selected month), as-of date, numerator, denominator, merge/withdrawal treatment and definition of resolved. Reopening changes the metric under that definition. Never divide resolutions occurring in a month by unrelated submissions received that month and call it a resolution rate.
- Median time to resolve describes only incidents with a documented resolution in the defined cohort. Show the unresolved cohort size alongside it; otherwise the fastest/easiest closed issues bias the figure.
- Show coverage start, active service categories, freshness and whether an area is outside the pilot, has no published records, has insufficient observations, or has records awaiting review. Do not disclose private queue details that identify reporters.
- Defer authority rankings, scores and league tables. Uneven adoption, unreported faults, category severity and service ownership make raw counts unsuitable as a council-performance judgement.

### Export implementation and removal

Generate public snapshots server-side from the same allowlisted projection used by the portal, with a stable as-of/version and a bounded filter set. Begin with a small pilot scope, daily snapshots and row limits; use async generation when necessary. No unrestricted database dump and no expensive generation job per anonymous click. Describe whether a download covers a full filtered snapshot or only a current result page; never imply that capped map markers are the full dataset.

Use a separate command/column allowlist from private staff exports. Check current publication/removal state before providing an export. Keep output objects behind the download service or short-lived links, rate limit access, audit aggregate export activity without collecting unnecessary visitor identity, and invalidate affected versions after a privacy/safety withdrawal. Retain safe snapshot metadata when removing unsafe historical files. Define and test a revocation window (proposed 15 minutes for current public views/download service); CDN/link expiry behavior must support it. Previously downloaded third-party copies cannot be recalled. Do not promise that every historical row or image will remain public forever.

Before calling the dataset openly licensed, agree ownership/reuse terms for reviewed metadata, resident contributions and any external source. Keep media rights separate and do not apply a blanket license to material we cannot license. Publish correction, withdrawal, versioning and attribution instructions. GeoJSON, a documented developer API, bulk historical releases and research integrations follow after the pilot demonstrates safe publication.

## 23. Public redesign implementation notes

The design reference follows the requested skill's app-screen rules: one question, a linked map/register as the dominant block, neutral chrome, clear source/freshness lines, derived counts, and a distinct phone composition. The signature is the **public evidence receipt**: each issue carries its first report, latest approved observation, actual handoff and resolution provenance. The portal offers a useful record even when no authority has responded.

The reference dataset has eight fictional incidents across CBD, Mbare, Southerton, Mufakose, Highfield, Belvedere, Avondale and Warren Park; six open and two resolved. They are explicitly labelled design examples, not actual reports, pilot coverage, council commitments or achieved repairs. The reference map is schematic. Replace all incident data and the schematic basemap with the approved live projection and configured map provider before launch.

Style choice: Achromatic ledger, seed 879817; original Segoe UI retained explicitly because external font retrieval was unavailable. Blue-grey civic ground and teal data marks provide the product face. No content photographs or third-party assets were used, so none are represented as real evidence.

Validation so far: source lint passed with zero failures/warnings. Automated browser inspection could not complete because the local headless browser exited during launch; the native preview fallback also failed to expose a usable window. Therefore no responsive browser-pass or functional UI-test claim is made. The design specimen is a planning reference, not deployed production code. Run the skill's real-browser 1440/768/390 checks, keyboard/state/filter/detail/download journeys and visual critique after implementation. The PDF concept is rendered and visually checked as a document.

### Zimbabwe source register

Reviewed 9 November 2026; accessible wording establishes the specific features described above, not verified uptime or complete market coverage.

- **[Z1] ZINARA public pothole map:** https://www.zinara.co.zw/potholes/
- **[Z2] ZINARA report form and publication review:** https://zinara.co.zw/potholes/report/
- **[Z3] CITE's own Fix My City launch article, 2 December 2021:** https://cite.org.zw/cite-launches-service-delivery-tracking-platform/
- **[Z4] LADS Africa Citizen Scoring Management:** https://ladsafrica.co.zw/public/services/citizen-scoring-management
- **[Z5] LADS Africa platform launch description:** https://ladsafrica.co.zw/news/president-mnangagwa-commissions-lads-africas-citizen-engagement-and-scoring-platform
- **[Z6] City of Harare report/enquiry form:** https://www.hararecity.co.zw/enquiries/create
- **[Z7] CHRA-attributed TauraHarare announcement, 21 October 2021, archived by Kubatana:** https://www.kubatana.net/2021/10/21/harare-goes-digital-in-service-delivery-monitoring-and-reporting/
- **[Z8] ZIMCODD CitizenApp launch brief, 17 March 2023:** https://zimcodd.org/?download_id=6383&sdm_process_download=1
- **[Z9] RoadSAFE operator features; only indexed copy available to this review:** https://roadsafe.co.zw/features
- **[Z10] Supplied Instatoll road-assets URL; inaccessible/unverified:** https://instatollroadassets.co.zw/about.php
- **Direct citizen portal checks; root unreadable, CRM inaccessible:** https://citizenengagement.co.zw/ and https://citizenengagement.co.zw/crm
