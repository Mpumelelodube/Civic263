# Spec: pilot boundaries, contacts, terms and rollout (P04)

Status: decisions agreed on 26 November 2026. The backend and public website were deployed the same day. The app changes need the next build. These are pilot operating rules, not legal conclusions; the privacy notice and terms need review by someone qualified in Zimbabwean law before public launch.

## Decisions

| Question           | Agreed rule                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pilot area         | All of Zimbabwe, labelled as a pilot. New and corrected reports must be pinned in Zimbabwe.                                                                   |
| Operator           | **Machdubit Tech Solutions** is named as running Civic263 and as data controller. Civic263 is independent: no council or provider runs or endorses it.        |
| Support contact    | Pending. The operator is buying a domain and creating a support mailbox. Until then the site and app show a marked placeholder, and launch is blocked.        |
| Public data terms  | The published text data is under CC BY 4.0, credited as "Civic263 public register, Machdubit Tech Solutions". Photos are viewable but not licensed for reuse. |
| Emergency guidance | Help numbers are shown for danger-prone services, with their source and the date checked. They are not yet confirmed by a Zimbabwean authority.               |

All of these live in one file, `packages/domain/src/pilot.ts`, which the app, website and server share.

## What changed

**Pilot area.** `isInPilotArea` tests a pin against Zimbabwe's outline (Natural Earth 1:110m, public domain). The outline is coarse: Mutare, Beitbridge and Mount Selinda fall just outside it. Pins within 35 km of the outline are therefore accepted too. As a result a few places just across the border, such as Livingstone and Musina, are also accepted; operators review every report anyway.

- The server refuses a new or corrected report pinned elsewhere, with "Civic263 is piloting in Zimbabwe only. Move the pin to the place in Zimbabwe you are reporting."
- The app's checklist says "Move the pin into Zimbabwe" before sending.
- Saved drafts pinned elsewhere still open, so the pin can be moved.
- Community visits are checked against the original report's pin, so they need no extra rule.

**Emergency guidance.** For Dangerous infrastructure, Crash / road obstruction, Stormwater and flooding, and Streetlights and electricity, the report screen shows "Is anyone in danger right now?". It says Civic263 does not contact emergency services and lists numbers residents can tap to call. The website's How evidence works page lists them too.

The numbers are from the UK government's travel advice for Zimbabwe, read on 26 November 2026: 112 for Econet mobiles, 114 for NetOne mobiles, and 0800 3222 911 from a landline. The Zimbabwe government portal's own list could not be read, because its site certificate is invalid. Other secondary sources quote 995 (police), 993 (fire), 994 (ambulance) and 999; none of these could be confirmed from an official page.

**Website.**

- New **Privacy notice** (`/privacy`) and **Terms and data reuse** (`/terms`) pages.
- About names the operator, the pilot area and the contact.
- Public data states the licence and defines each CSV field. Every CSV download repeats the licence and credit in two new columns.
- Review wording no longer says every report is checked automatically.

**App.**

- The account screen has an About Civic263 section: operator, pilot, support contact (or the placeholder), and links to the privacy notice and terms.
- The report screen names the operator and pilot, and says review happens before publication.

## Launch gates (rollout decision)

**Decision on 26 November 2026: not ready for a public launch or store release.** A closed pilot with known testers can continue on the existing builds. `npm run check:launch` fails while gates 1 and 2 are open in code.

| #   | Gate                                                                                                                                                                                                                                                                                                                                                   | State                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Support mailbox exists and `SUPPORT_EMAIL` is set.                                                                                                                                                                                                                                                                                                     | Open (owner is buying a domain)                                                                                                                                                                                                                                                               |
| 2   | Emergency numbers confirmed with a Zimbabwean authority (for example the ZRP or the government portal), then `confirmedLocally` set.                                                                                                                                                                                                                   | Open                                                                                                                                                                                                                                                                                          |
| 3   | Data protection registration: under the Cyber and Data Protection Act and its 2024 regulations (S.I. 155 of 2024), data controllers generally need a POTRAZ licence and a data protection officer. Confirm what applies to Machdubit Tech Solutions, and the basis for storing data in the EU and for automatic review by OpenAI in the United States. | Open (see [Mondaq](https://www.mondaq.com/data-protection/1626192/data-protection-obligations-in-zimbabwe-is-your-organisation-aligned) and [MISA](https://zimbabwe.misa.org/2025/03/14/navigating-the-data-protection-act-requirements-ensuring-compliance-for-zimbabwean-data-controllers)) |
| 4   | Qualified review of the privacy notice and terms, including the age wording ("meant for adults").                                                                                                                                                                                                                                                      | Open                                                                                                                                                                                                                                                                                          |
| 5   | App build containing P01–P04, with device acceptance (R03–R07, R09).                                                                                                                                                                                                                                                                                   | Open (builds deferred by the owner)                                                                                                                                                                                                                                                           |
| 6   | Operator multi-factor sign-in (Identity Platform) before adding operators beyond the owner.                                                                                                                                                                                                                                                            | Open                                                                                                                                                                                                                                                                                          |
| 7   | Store listings: privacy policy URL `/privacy`, support URL, and the privacy answers below.                                                                                                                                                                                                                                                             | Draft below; needs gates 1 and 4                                                                                                                                                                                                                                                              |
| 8   | A named person checks the review queues every working day, per the [moderation runbook](MODERATION_SPEC.md), and the weekly and monthly tasks in the [operations runbook](OPERATIONS_RUNBOOK.md).                                                                                                                                                      | In place (the owner)                                                                                                                                                                                                                                                                          |

## Store privacy answers (draft)

For Google Play's Data safety form and Apple's App Privacy details. All data is encrypted in transit. Residents can delete their account and data in the app.

| Data                                                             | Collected                         | Shared with third parties | Purpose                                    | Optional                   |
| ---------------------------------------------------------------- | --------------------------------- | ------------------------- | ------------------------------------------ | -------------------------- |
| Precise location (report pin, visit position)                    | Yes                               | No                        | App functionality                          | Yes (a place can be typed) |
| Photos                                                           | Yes                               | No                        | App functionality (published after review) | Yes                        |
| Other user content (descriptions, appeals, concerns)             | Yes                               | No                        | App functionality                          | Descriptions are required  |
| Email address                                                    | Yes                               | No                        | Account recovery                           | Yes                        |
| Device or other IDs (anonymous account, notification address)    | Yes                               | No                        | App functionality, fraud prevention        | Notifications are optional |
| Background location (nearby reminders, worked out on the device) | Used on device; no history stored | No                        | App functionality                          | Yes                        |

Service providers that process data on Civic263's behalf (Google Cloud and Firebase, Google Maps, OpenAI for automatic review, Apple and Google push) count as processors, not third-party sharing. Data is not used for advertising or tracking, and no data is sold.

## Verification

- `packages/domain/src/pilot.test.ts`:
  - towns across Zimbabwe, including those on the coarse edge, are accepted, and nearby capitals and distant places are refused;
  - new and corrected reports pinned elsewhere are refused, while saved drafts stay readable;
  - danger categories are listed, and launch blockers are reported.
- `scripts/tablet-panes.test.ts`: the composer checklist refuses a pin outside the pilot area.
- `npm run check:launch` lists the open code-level blockers.
- `scripts/test-live-backend.py`: the live server refuses a pin in Lusaka with the Zimbabwe-only message. All 14 live checks passed on 26 November 2026.
