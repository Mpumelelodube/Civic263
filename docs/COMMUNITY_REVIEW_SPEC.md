# Community field reviews

Approved direction: 13 November 2026. Any signed-in resident may report a fix to a published issue. A different resident who opts into reviewing may confirm or reject it from the mobile app. Background nearby alerts are included. No genuine issue may be changed merely for acceptance testing.

## Behaviour

- A fix report requires a fresh, accurate, non-mocked position within 20 metres of the original private site and 1-3 new camera photos. It changes workflow to resolution-pending, retains the active pin and displays "Fix reported - awaiting community confirmation".
- Confirmation or rejection requires reviewer opt-in, a different reporting identity from the fix proposer, the current fix identifier, and the same on-site camera evidence checks. One independent confirmation resolves the issue; rejection returns it to its previous active workflow. Existing events/evidence remain in history. Unreviewed fixes never confirm automatically.
- Community actions concern published incidents only. Original report identities, precise private pins, original private photos and contact data are never returned to other residents. Legacy resolved records remain readable. Private/held reports do not become public through this flow.
- A private field-check record owns each participant's originals. Public field-check DTOs contain structured action, timestamps and privacy-cleared derivatives only. Automatic privacy screening is independent of community condition confirmation.
- Original reporters receive an inbox update when a fix is proposed and reviewed. Fix proposers receive the result. Notification writes are part of the lifecycle transaction; push is an additional delivery signal, not the record of truth.
- Any resident can opt into reviewing. Nearby reminders, background location and push delivery are separate opt-ins. Users can pause them. A resident cannot confirm their own fix. Different device identities are not proof of different humans; stronger recoverable identity and attestation remain release concerns.
- Nearby reminders use a 200 m discovery radius, at most one alert per issue per day and three nearby alerts per day. Server checks still require 20 m for evidence. A small refreshed set of nearby geofences and movement updates support background discovery without storing routes on the server. Foreground use remains available if background permission is denied. OS termination/battery policies can stop background delivery.
- Standalone Android requires native Firebase client configuration for FCM. The user explicitly chose the existing Maps credential for both native Maps and server lookups on 13 November; reuse it and do not create another Maps key. Keep its value out of tracked source and logs. Expo Go cannot validate background delivery or Android remote push. iOS remote push additionally requires configured Apple/APNs credentials.

## Implementation slices

1. Shared states, explicit projections, command validation and transition tests.
2. Transactional field checks, opt-in preferences, private inbox, privacy-screened public media and bounded push delivery through existing authenticated transports/triggers.
3. Mobile Community tab: review queue, preferences, inbox and contribution history; public/owner details allow fix reporting, confirmation and rejection. Map pins and portal show pending status until confirmation.
4. Foreground/background notification tasks, permissions, Android development-build configuration and native acceptance where configured.
5. Demo multi-identity integration, live isolation/permission checks, deployment and `npm run verify`.

All mutations use server commands. Tests cover self-review, opt-out, stale fix IDs, foreign/private records, GPS/photo boundaries, concurrent proposals/reviews, stable retries, private media denial, notification duplication and reminder cooldowns. Use existing Expo SDK 58 theme/components and the public portal's Achromatic ledger direction.
