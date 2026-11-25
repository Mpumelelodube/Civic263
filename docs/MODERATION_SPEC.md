# Spec and runbook: appeals, complaints and operators (P02)

Status: behaviour agreed, and backend and console deployed, on 25 November 2026 (https://civic263-ops.web.app). The resident app screens await the next build. These are pilot operating rules, not legal conclusions. Confirm them with the operating authority before public rollout (P04).

## Decisions

| Question                   | Agreed rule                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who reviews                | Named operators in a private web console (`apps/ops`). Operator accounts are email and password, granted and removed by an administrator script. This is the first piece of the L01 staff tooling. |
| Complaints before a review | Content stays visible until three different reporting identities report the same item; it is then hidden until an operator decides.                                                                |
| Appeals                    | Any report kept private by automatic review can be sent for a human review once.                                                                                                                   |
| Response target            | A first decision within two working days. Complaints about personal information or danger are listed first. The public support contact is still a P04 placeholder.                                 |

## Residents

**Ask for a human review.** On a held report the owner sees **Ask for a human review**, with an optional note of up to 500 characters. Corrections pause while the appeal is open, so the reviewer judges what the resident saw; withdrawal still works. The owner sees the deadline, then the decision:

- **Published**: the reviewer wrote neutral public text and chose which photos to publish. The public record says it was published after human review.
- **Kept private**: one of five reasons, plus an optional note from the reviewer.

There is one appeal per report. Test reports cannot be appealed.

**Report a concern.** Anyone using the app can report a public issue, one public photo, or the photos from one community visit, with a reason and an optional 300-character note. Reports are private: the poster is never told who reported them. Each identity counts once per item, with at most 20 reports a day. The app collects these reports only from attested app installations. The web portal has no reporting form yet, because anonymous web input would let one person create the three identities needed to hide something.

When three different identities have reported an item, it is hidden:

- **An issue** leaves the register and map. Community checks on it pause, and the owner sees that it is under review.
- **A photo** leaves the public sequence, and the remaining photos close the gap. The stored files keep their names, so restoring a photo is exact.
- **Visit photos** become private.

A separate identity is not proof of a separate person, which is why a reviewer can always restore the item.

## Operators

**Access.** An operator needs all three of the following, and the server checks them on every command:

- a password sign-in,
- a verified email,
- an active `staffMembers/{uid}` record with role `moderator`.

Signing in alone shows nothing. Use `scripts/manage-staff.py add|remove|list --account <admin gcloud login>`:

- `add` creates the account if needed and emails a link to set a password.
- `remove` deactivates the record and signs the account out everywhere.

Firebase multi-factor sign-in requires upgrading to Identity Platform. That upgrade is recommended before more than one or two operators are added; until then, use a long unique password.

**Queues.**

- **Appeals**, oldest first.
- **Complaints**, priority first, then deadline.
- **Held reports**: every report automatic review kept private. An operator may publish one without an appeal.
- **Blocked identities.**

Each report page shows the private submission, original photos, the automatic review reason, the appeal note, the public record with hidden and removed photos, and what complainants wrote.

**Decisions.** Every decision is written to `moderationAudit` with the operator's UID.

| Action            | Effect                                                                                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publish           | Creates the public record from the operator's title, summary and area (no contact details, links or handles) and the chosen photos, re-encoded like automatic derivatives. The report must still be held and unchanged since the operator opened it. |
| Keep private      | Records one of five reasons, plus an optional note, that the resident sees. Only for an open appeal.                                                                                                                                                 |
| Restore / dismiss | Returns hidden content to public view and closes the complaint. Hiding it again needs three new reporters.                                                                                                                                           |
| Remove            | **Issue**: unpublished; the owner's report is marked rejected; its public photos are deleted; the private originals stay with the owner. **Photo or visit photos**: that public derivative is deleted.                                               |
| Block             | Hashed by identity. The blocked person cannot add reports, visits, corrections, appeals or complaints, but can still read, withdraw and delete their data. Operators never see the UID. Unblocking needs a reason.                                   |

## Support and escalation procedure

1. **Check the queues every working day.** Clear high-priority complaints first; the console marks overdue items.
2. **Personal information about a third party** (faces, number plates, homes, names, phone numbers): remove it rather than restore it. If only the text is at fault on a held report, publish with rewritten text instead of keeping the whole report private.
3. **Danger to life** (for example an open manhole on a busy road): Civic263 is not an emergency service. Record the decision, and tell the person to use the emergency contacts published under P04. Do not promise dispatch.
4. **Threats, hate or repeated spam** from one identity: remove the content and block the contributor, recording why.
5. **Requests from authorities, legal complaints or press**: do not act in the console. Escalate to the project owner the same day with the report reference only.
6. **Disagreements between operators, or decisions you are unsure about**: keep the item hidden and escalate to the project owner. Note the uncertainty in the decision note.

Response targets count working days Monday to Friday (UTC). Public holidays are not modelled yet.

## Data and retention

- Complaint records hold the target, reason, optional note, time and a SHA-256 of the reporter's UID. Account deletion (P01) deletes them; the aggregate counts on the reported item stay.
- Appeals hold the resident's note. Withdrawal or account deletion deletes the appeal.
- Blocks are keyed by a hash of the UID and are deleted with the account.
- `moderationAudit` keeps action, target, outcome, reason and operator UID, with no resident identity. Its retention is part of P03.
- Daily complaint counters expire through the eighth TTL policy (`complaintDailyUsage.expiresAt`).

## Verification

- Domain unit tests: deadlines, eligibility, parsing, auto-hide threshold, priority and operator text rules.
- `npm run test:moderation` against loopback demo emulators covers operator authorization, both appeal decisions, photo, issue and visit complaints (hide, restore, re-hide, remove), community pausing, blocks, withdrawal closing an appeal, account deletion erasing complaints, and the built `staffCommand` callable.
- Device and browser acceptance follow the next app build and the console deployment.
