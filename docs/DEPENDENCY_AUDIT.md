# Dependency audit (R08)

Triage of `npm audit` for the whole workspace, 24 November 2026. The 13 November audit recorded 25 findings (4 high, 20 moderate, 1 low, no critical). A fresh audit before any change reproduced the same 25.

After compatible updates the audit reports **12 findings: 12 moderate, 0 high, 0 low, 0 critical**. No Expo SDK change, Firebase major change or downgrade was made. npm's own suggested fixes for the remaining items are downgrades (`expo@52`, `firebase@9.14`) or majors (`firebase-admin@14`) and were not applied.

## Fixed (13 findings)

| Change                                                                                                                                         | Clears                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root override `@grpc/grpc-js` 1.14.6 (was 1.9.16 under the Firebase web SDK). Firebase Admin already used 1.14.6, so one copy now serves both. | 4 high: `@grpc/grpc-js` ([GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) and the server error-message advisory), `@firebase/firestore`, `@firebase/firestore-compat`, `firebase` |
| `@expo/cli` 58.1.19 → 58.1.21 (within SDK 58's range; replaces `glob` with `tinyglobby`)                                                       | `@expo/cli`                                                                                                                                                                                               |
| `node-forge` 1.4.2 → 1.4.4 (in range)                                                                                                          | `node-forge` (Ed25519, TLS and header ReDoS advisories)                                                                                                                                                   |
| `fast-xml-parser` 5.11.2 → 5.12.1 (in range)                                                                                                   | `fast-xml-parser` (low)                                                                                                                                                                                   |
| `@google-cloud/storage` 7.19.0 → 7.22.0 (Functions, minor)                                                                                     | its direct advisory path                                                                                                                                                                                  |
| `typescript-eslint` 8.59.3 → 8.74.0 (dev only, minor)                                                                                          | 6 `typescript-eslint` / `minimatch` dev-tooling entries                                                                                                                                                   |

The latest Firebase web SDK (13.4) still pins `@grpc/grpc-js ~1.9.0`, so the override is the only compatible fix. The mobile app and the web portals load the React Native or browser Firestore build, which does not use gRPC. The override affects Node only: Functions and the emulator integration scripts.

## Remaining (12 moderate, not patched)

These are **not** fixed. The reachability notes explain the current exposure; they are not a substitute for the upgrade.

### Google Cloud / Firebase Admin `uuid` chain (8 entries, Functions only)

`uuid` below 11.1.1 ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): missing buffer bounds check in v3/v5/v6 when a `buf` argument is supplied). It is reported through `gaxios`, `google-gax`, `teeny-request`, `retry-request`, `@google-cloud/storage`, `@google-cloud/firestore` and `firebase-admin`.

- **Reachability:** the installed libraries call only `uuid.v4()` with no buffer (`gaxios` and `teeny-request` multipart boundaries, `google-gax` request IDs). Civic263's own code does not import `uuid`. No resident input reaches these calls.
- **Fix path:** `firebase-admin` 14 (major) or upstream Google libraries moving to `uuid` 11. Plan it as a separate Functions upgrade with the publication, community and intake integration suites. Do not force a cross-major `uuid` override into the deployed Functions.

### Expo fingerprint `glob` / `minimatch` chain (4 entries, build tooling)

`glob` 13 ([GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)) and `minimatch` 10 ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)), reported through `@expo/fingerprint` and `expo`.

- **Reachability:** `@expo/fingerprint` runs on developer machines and EAS build workers to hash local project files with fixed patterns. It is not part of the app bundle, and it takes no untrusted patterns or timeouts.
- **Fix path:** the newest SDK 58 patch (`expo` 58.0.26 with `@expo/fingerprint` 0.21.10) still depends on `glob ^13` and `minimatch ^10`. Re-check on each Expo patch and at the SDK 59 upgrade; do not override across majors inside Expo's toolchain.

## Verification

- `npm audit`: 12 moderate, 0 high, 0 low.
- `npm ls --all`: no missing or invalid packages. `npm install --package-lock-only` regenerates the lockfile unchanged, and `npm ci --dry-run` passes.
- `npm run verify`: 65 tests, all workspace type checks, ESLint with the updated `typescript-eslint`, web/ops/Functions production builds and the Expo dependency check.
- Emulator integration suites against loopback demo Auth/Firestore/Storage emulators (firebase-tools 14.20.0, Java 17), never production: `test:publication`, `test:community`, `test:intake -- --http-handler` and `test:identity` all passed. The intake run exercised the Firebase client SDK's Node gRPC connection on 1.14.6, including the expected denial of direct client writes. `test:identity` ran with the local demo callable server (`node scripts/intake-test-server.mjs`) on port 5001, because CLI 14 cannot host the Functions SDK 7 emulator.
- Native: no native dependency changed. The next native build for the tablet layouts (R09) will include these JavaScript updates.
