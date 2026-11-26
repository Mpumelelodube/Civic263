# Spec and runbook: costs, monitoring, recovery and retention (P03)

Status: decisions agreed on 26 November 2026, and applied to production the same day with the administrator's approval (see [Applying this](#applying-this)). Automatic review has been off since then. These are pilot operating rules, not legal conclusions.

## Decisions

| Question              | Agreed rule                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Monthly budget        | $5, counting project `civic263-df6ec` only. The billing account also pays for other projects.                                                                                                    |
| Over budget           | Alerts only. Billing administrators get emails at 50%, 90% and 100% of actual spend, and when the month's forecast passes 100%. Billing figures lag by hours, so a budget is not a spending cap. |
| Paid automatic review | **Off.** Switched off to avoid AI costs. On 26 November the provider was changed to the OpenAI Decisions API, the cheapest option; it is switched on once the OpenAI key is in place.            |
| Recovery copies       | 7 days. Firestore point-in-time recovery plus a daily backup, each kept 7 days, and database delete protection. Storage already keeps deleted files for 7 days.                                  |
| Unpublished reports   | Kept until the resident withdraws them or deletes their account. Revisit with the operating authority (P04).                                                                                     |

## Automatic review switch

Automatic review sends each new report's text and photos to the OpenAI Decisions API in one call, then publishes standard wording and the approved photos if the answers pass (see [Automatic publication](FIREBASE_BACKEND.md#automatic-publication)). It also screens resolution and community-visit photos. These are the only AI calls in Civic263. Until 26 November the provider was Cloud Vision and Gemini.

### Setting up the OpenAI key

The owner does these steps; the key never passes through chat or the repository.

1. At platform.openai.com, buy prepaid credit (for example $5) and leave auto-recharge off. Spent credit stops the calls; reports then wait for an operator.
2. Create a project for Civic263 and set its monthly budget. If the organisation is offered European data residency, choose it when creating the project, then change `DECISIONS_URL` and the privacy notice before switching review on.
3. Create a secret key in that project and store it in Secret Manager from your own terminal. The command asks for the key without showing it:
   ```
   npx firebase-tools@15.35.0 functions:secrets:set OPENAI_API_KEY --project civic263-df6ec
   ```
4. Deploy the functions, then run the live contract check. It reads the key from Secret Manager through a pipe and stores nothing:
   ```
   gcloud secrets versions access latest --secret OPENAI_API_KEY --project civic263-df6ec --account ADMIN_LOGIN | node --experimental-strip-types scripts/test-review-provider.mjs
   ```
5. Switch review on with `manage-operations.py`.

To rotate the key, set the secret again and redeploy the functions; then revoke the old key in OpenAI.

The switch is the Firestore document `operations/automaticReview`. Review runs only when it says `enabled: true`, so a missing or damaged document means **off**. Every attempt checks the switch, so turning it off also stops retries already in progress.

```
python scripts/manage-operations.py review status --account ADMIN_LOGIN
python scripts/manage-operations.py review off --account ADMIN_LOGIN --note "Why"
python scripts/manage-operations.py review on --account ADMIN_LOGIN --note "Why"
```

While review is off:

- **New and corrected reports** stay private, marked as waiting for a person (`reviewReason: staff-review`). The resident sees "Waiting for a person to review". They appear first in the console's **Held reports** queue, each with a deadline of 2 working days. An operator either publishes the report with their own wording and chosen photos, or keeps it private with a reason the resident sees. Residents cannot appeal these reports, because a person is already reviewing them. A correction resets the decision.
- **Resolution and community-visit photos** stay private. The resolution and the visit outcome are still recorded, and the issue still leaves the active map when it is resolved.
- **Nothing else changes.** Reporting, the public register, community checks, appeals and complaints keep working.

Switching review back on does not reprocess reports that were waiting. Operators still decide those.

When on, automatic review runs at most 100 times a day across reports, resolutions and visits. Each review is one Decisions call. OpenAI charges $0.10 per million input tokens for `gpt-6-luna` and nothing for output. A 3-photo report is roughly 5,000 tokens (OpenAI does not publish the image token count for this model, so this is an estimate), about $0.0005. Even 100 reviews every day would be about $1.50 a month, and European processing would add 10%. For comparison, in the six weeks to 26 November production made 11 review calls in all.

## What costs money

| Service                             | Used by                                           | Limits in place                                                                                        |
| ----------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| OpenAI Decisions (billed by OpenAI) | Automatic review                                  | Switched off. When on, 100 reviews a day, and prepaid credit with auto-recharge off.                   |
| Google Maps Places and Geocoding    | Address search in the app (`lookupPlace`)         | Per-identity daily quota (`placeLookupQuotas`). Billed per request beyond Google's monthly free usage. |
| Cloud Functions (Cloud Run)         | Every command and the public API                  | At most 2 instances per function, none kept warm. Public pages are cached for 30 seconds.              |
| Firestore, Storage, Hosting         | Records, photos, web pages                        | Pilot volumes are megabytes. Daily quota collections expire through TTL.                               |
| Cloud Monitoring                    | Two alert conditions and one uptime check         | About $0.10 per alert condition a month; uptime checks are within the free allowance.                  |
| Firestore recovery                  | Point-in-time recovery and daily backups          | Charged by stored size, currently megabytes.                                                           |
| Artifact Registry                   | Images behind deployed functions (222 MB, 26 Nov) | Cleanup rule: delete after 7 days, always keeping the 2 latest of each.                                |

## Monitoring

`scripts/setup-operations.py` creates the following. They email the administrator's alert channel:

- **Civic263 site or API is down.** An uptime check fetches `https://civic263-df6ec.web.app/api/health` every 15 minutes from Europe, the USA and Asia-Pacific. It alerts when more than one region fails.
- **Civic263 backend errors.** A log-based metric counts ERROR logs from the function services. It alerts at 5 or more in an hour. A failing review logs a few errors while it retries, so a single provider hiccup stays below the threshold.
- **Budget.** Emails to billing administrators, as above.

### When an alert arrives

- **Site or API down.** Open the public site and `/api/health`. Check [Cloud Run](https://console.cloud.google.com/run?project=civic263-df6ec) for failed revisions and the Firebase Hosting release history. Roll back the last deploy if it caused the problem. Reports wait safely on residents' devices as drafts.
- **Backend errors.** Open [Logs Explorer](https://console.cloud.google.com/logs/query?project=civic263-df6ec) with `resource.type="cloud_run_revision" AND severity>=ERROR`. Errors carry report IDs, never report content. Failing automatic reviews hold the report privately after 5 attempts; operators can publish it from Held reports.
- **Budget threshold.** Open [Billing reports](https://console.cloud.google.com/billing/01E2B9-AAB814-BB40D9/reports) filtered to `civic263-df6ec`. If automatic review was switched on, consider switching it off. If Maps lookups are the cost, look for repeated lookups from one identity. To pause public traffic in an emergency, roll back the Hosting release or disable the function in the console.

## Recovery

| What                             | Protection                                                                                                          | Recovery                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Firestore records                | Point-in-time recovery: any minute in the last 7 days. Daily backup kept 7 days. Delete protection on the database. | Clone or restore into a new database, check it, then copy back what is needed. Never overwrite `(default)` in place.             |
| Photos (Storage)                 | Soft delete: deleted objects recoverable for 7 days.                                                                | `gcloud storage restore gs://civic263-df6ec.firebasestorage.app/PATH#GENERATION` (list with `gcloud storage ls --soft-deleted`). |
| Functions, rules, indexes, sites | Source in Git.                                                                                                      | Redeploy from the last good commit.                                                                                              |

**Erased data and copies.** Data that a resident withdraws or erases leaves Firestore immediately, and every recovery copy expires within 7 days. Leftover uploads that no record names are removed by the orphan sweep below.

### Restore drill

Run it after applying the settings, then monthly:

```
python scripts/restore-drill.py --account ADMIN_LOGIN               # from point-in-time recovery
python scripts/restore-drill.py --account ADMIN_LOGIN --from-backup # from the latest daily backup
```

The drill copies the live database into a temporary `drill-YYYYMMDD-HHMM` database, then checks it. It compares document counts with live, confirms every public record has its report and incident, and confirms every published photo the copy names exists in Storage. It then deletes the copy, because the copy holds private data. Cloning took about 11 minutes on 26 November, so allow 20 minutes. If a drill is interrupted, `--resume drill-YYYYMMDD-HHMM` checks and deletes that copy. Record the result and its duration under [Drill log](#drill-log).

## Retention

| Data                                                                                                            | Kept                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Unpublished reports and their photos                                                                            | Until the resident withdraws the report or deletes their account.                            |
| Published issues                                                                                                | Indefinitely as the public record; anonymised when the reporter deletes their account (P01). |
| Uploads no record names (abandoned attempts, superseded leases, unadopted review batches, unfinished deletions) | 7 days, then removed by the orphan sweep.                                                    |
| Daily quota counters, deletion markers, field-test grants                                                       | Expire automatically (eight TTL policies).                                                   |
| Complaints, appeals and blocks                                                                                  | Until the resident's account is deleted (P02). A time limit is a P04 decision.               |
| `moderationAudit`, `reviewAudit`, `reportEvents`                                                                | For the pilot. Set a period with the operating authority (P04).                              |
| Cloud Logging                                                                                                   | 30 days (default bucket). Request logs include caller IP addresses.                          |
| Recovery copies                                                                                                 | 7 days (above).                                                                              |

### Orphan sweep

Run it weekly:

```
python scripts/cleanup-orphans.py --account ADMIN_LOGIN          # dry run: counts only
python scripts/cleanup-orphans.py --account ADMIN_LOGIN --apply
```

The sweep finds objects under `private/reports/` and `public/incidents/` that no report, community visit or public issue names, and that are at least 7 days old. Names that match no known pattern are counted and never touched. `--apply` re-reads each affected report's records just before deleting, and deletes with a generation precondition. Deleted objects remain recoverable for 7 days.

It runs with an administrator's login, because the backend service account deliberately cannot list objects. It replaces the earlier tool, which only handled superseded community-visit uploads.

The first dry run, on 26 November 2026, recognised all 34 stored objects (32 report originals and 2 resolution originals from the 12 November live test). All were still referenced, so nothing was eligible.

## Weekly checklist

1. Check the console queues every working day (see the [moderation runbook](MODERATION_SPEC.md)).
2. Weekly: run the orphan sweep, and look at the month's spend in Billing reports.
3. Monthly: run the restore drill and record it below.
4. After every deploy: run `python scripts/test-live-backend.py --account ADMIN_LOGIN`.

## Applying this

Done on 26 November 2026, in this order:

- All nine functions and the ops site were deployed.
- The switch was recorded as off at 09:10 UTC.
- `setup-operations.py --apply` made all ten changes; a rerun reports everything in place. Its first run stopped at the backend-error alert, because a new log-based metric takes a few minutes to become usable; the rerun a minute later completed.
- The live backend check passed all 13 checks.
- The first restore drill passed (see [Drill log](#drill-log)).

To set up again from scratch:

1. Deploy Functions. This brings in the switch. Automatic review is off from that moment, because no switch document exists yet.
2. Deploy the ops Hosting site, which shows the review state and the Held queue deadlines.
3. `python scripts/manage-operations.py review off --account ADMIN_LOGIN --note "Keep AI costs down"` records the decision explicitly.
4. `python scripts/setup-operations.py --account ADMIN_LOGIN` to review the plan, then rerun with `--apply`.
5. `python scripts/restore-drill.py --account ADMIN_LOGIN` a few minutes after step 4, once point-in-time recovery is on.
6. Run the live backend check.

## Drill log

| Date        | Source                                     | Duration                                                 | Result                                                                                                                                                                    |
| ----------- | ------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 26 Nov 2026 | Point-in-time recovery, snapshot 09:28 UTC | Clone 676 s, then about 6 minutes of checks and deletion | Passed. All 16 checked collections matched live (18 reports, 10 events, 6 deletion markers and others). No original or published photo was missing. The copy was deleted. |

The first attempt that day exposed three gaps in the script, now fixed. The final run above used the fixed script.

- A new copy refuses requests for a while after its clone operation reports done; the script now waits for it.
- gcloud handed out a cached token that expired mid-drill; the script now refreshes it.
- A copy inherits the live database's delete protection; the script now lifts it on the `drill-` copy before deleting.

Neither copy outlived the session.
