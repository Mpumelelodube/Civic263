# Civic263

Report it. Track what happens.

A monorepo for Zimbabwe's public municipal issue register. Residents report without a visible account flow, the public can explore reviewed evidence, and authorized operators manage incidents.

| Directory         | Application / responsibility                                                       |
| ----------------- | ---------------------------------------------------------------------------------- |
| `apps/mobile`     | Expo SDK 58 + React Native resident app; Nearby, Report and My reports routes      |
| `apps/web`        | React + Vite public register, area information, public-data and methodology routes |
| `apps/ops`        | Separate React + Vite operations application and staff-auth boundary               |
| `packages/domain` | Shared categories, models, publication projection and validation                   |
| `packages/web-ui` | Browser-only shared shell components and CSS tokens                                |
| `functions`       | Independently deployable Firebase Functions backend                                |
| `firebase`        | Firestore rules/indexes and Storage rules                                          |
| `docs`            | Architecture, configuration and implementation handoff                             |

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

Public web runs on http://localhost:5173, operations on http://localhost:5174. Expo prints a QR code for the resident app. The starter experience uses Expo Go-compatible modules; production native Firebase integration will require development builds.

Copy each application's `.env.example` to `.env.local` (mobile uses `.env`) when connecting external services. No real Firebase IDs or Maps keys are included. Public and ops apps start without credentials.

## What is implemented in the scaffold

- One npm workspace with a root lockfile, shared types and independent application commands.
- Public demo register with linked schematic map/list, working service filters, issue detail routes, public-data sample download and methodology.
- Native resident navigation and drafts stored on the device with Expo File System. Saving a draft does not submit a report to a municipality or Firebase.
- Separate operations shell. Private operational data is not loaded and no staff authorization is simulated.
- Firebase configuration, deny-by-default rules, owner-only report reads, composite indexes and an emulator-ready health function.
- Type checking, linting, privacy/validation unit tests, production builds and CI.

Live Google Maps, silent Firebase ownership, report uploads, server intake commands, staff authentication/authorization, moderation, publication, push and store release setup are subsequent implementation work. See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

## Verification

```sh
npm run verify
npm run emulators
```

Java is needed for the Firestore emulator. Emulators use the deliberately non-production `demo-civic263` project. The health endpoint is `/api/health` on the public Hosting emulator. Cloud deployment needs a real project, Hosting targets and reviewed rules; nothing is deployed automatically.

## Repository

Target remote: https://github.com/Mpumelelodube/Civic263.git

Use a feature branch for implementation and review the checks before merging. Do not force-push or replace unrelated repository history.

The resident app began from the official Expo default template (0BSD, retained in `apps/mobile/LICENSE`), with Civic263 routes replacing the sample screens. Unused sample artwork was removed; add approved Civic263 icons before release.
