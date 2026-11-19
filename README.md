# Civic263

Report it. Track what happens.

A monorepo for Zimbabwe's public municipal issue register. Residents report with a silent identity, can optionally save that identity for recovery, and can report or independently confirm fixes. The public portal shows reviewed evidence and retained history. Staff operations remain a separate application scaffold.

## Current checkpoint

Tracking updated 19 November 2026; build/Android device evidence is from the 13 November checkpoint. Reporting, private photos, automatic publication review, the public portal and community resolution are implemented and were deployed. A standalone signed Android acceptance app passed Note9 startup and live native attestation. Firebase production APNs is configured, and Apple validated iOS 0.1.0 build 4 for internal TestFlight testing on 19 November. On iPad Pro M2/iPadOS 26, protected photo viewing and background push/tap-to-reopen have passed. Build 5 contains the tested owner-report link fix and awaits private TestFlight delivery. Remaining device controls, physical iPhone coverage, the outdoor geofence walk and process/battery checks remain open.

Start with the [delivery plan](tasks/plan.md), [task tracker](tasks/todo.md), [implementation status](docs/IMPLEMENTATION_STATUS.md) and [native release evidence](docs/NATIVE_RELEASE.md). A completed archive does not establish device acceptance or public rollout readiness.

| Directory         | Application / responsibility                                                       |
| ----------------- | ---------------------------------------------------------------------------------- |
| `apps/mobile`     | Expo SDK 58 resident app; Nearby, Report, Reviews and My reports                   |
| `apps/web`        | React + Vite public register, area information, public-data and methodology routes |
| `apps/ops`        | Separate React + Vite operations application and staff-auth boundary               |
| `packages/domain` | Shared categories, models, publication projection and validation                   |
| `packages/web-ui` | Browser-only shared shell components and CSS tokens                                |
| `functions`       | Independently deployable Firebase Functions backend                                |
| `firebase`        | Firestore rules/indexes and Storage rules                                          |
| `docs`            | Architecture, configuration and implementation handoff                             |
| `tasks`           | Ordered delivery plan, acceptance criteria and current task checklist              |

## Start locally

Use Node 22.13+ (22.22.3 is recorded in .nvmrc) and npm 10+.

```sh
npm ci
npm run dev:web
```

In separate terminals:

```sh
npm run dev:ops
npm run dev:mobile
```

Public web runs on http://localhost:5173, operations on http://localhost:5174. Expo prints the development URL for the resident app. Trusted local Expo Go testing can use development attestation; release App Check, background work and iOS push require the configured native build.

Copy each application's `.env.example` to `.env.local` and follow [configuration notes](docs/CONFIGURATION.md). Firebase project identifiers are versioned; credentials, native Firebase service files, signing material and local environment files are excluded from Git. Real services and device tests require their separately configured projects.

## Implemented flows

- Map dashboard, service icons/colours, system themes, typography, motion and five-kilometre viewport loading.
- Zimbabwe Places lookup, map/GPS location selection, persistent drafts/retries and server-confirmed receipts.
- Zero to three compressed initial photos; private originals and reviewed public derivatives.
- Owner-only report history, private galleries and optional email/password linking/recovery that preserves the resident UID.
- Public register, selected-issue map, details, community evidence history, resolved archive and allowlisted CSV fields.
- Fix reports by any resident and confirmation/rejection by another opted-in identity, with on-site GPS within 20 m and 1-3 new camera photos.
- Private inbox, opt-in nearby/background/push preferences and bounded notification delivery.
- Validated Firebase commands, automatic privacy/publication review, default-deny direct writes/uploads and six technical expiry policies.
- Native Play Integrity/App Attest bridge, signed Android/iOS artifacts, verification commands and demo integration scripts.

The operations shell does not implement staff authorization, duplicate merge, assignments or official handoffs. See the tracker for remaining device checks, dependency updates, account lifecycle, operational and pilot gates. Fixtures and local drafts are never real public reports or municipal acknowledgements.

## Verification

```sh
npm run verify
npm run emulators
```

The recorded emulator checks used Java 21 and the deliberately non-production `demo-civic263` project. Additional community, publication, identity-recovery and field-access scripts are documented in [backend notes](docs/FIREBASE_BACKEND.md) and the delivery plan. They require the stated demo services; they do not establish live device acceptance. Cloud deployments require configured projects and are not run by `npm run verify`.

## Repository

Target remote: https://github.com/Mpumelelodube/Civic263.git

Use a feature branch for implementation and review the checks before merging. Do not force-push or replace unrelated repository history.

The resident app began from the official Expo default template (0BSD, retained in `apps/mobile/LICENSE`). Civic263 routes, icons and a native launcher icon replace the sample experience.
