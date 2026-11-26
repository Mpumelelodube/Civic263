import type { CategoryId } from './categories.ts';

/**
 * Pilot boundaries and public contacts (P04), agreed 26 November 2026. One place for every
 * statement the app, site and privacy notice make about who runs Civic263 and where it works.
 */
export const OPERATOR = {
  name: 'Machdubit Tech Solutions',
  /** No municipality or service provider is a partner; nothing implies official status. */
  independent: true,
} as const;

/**
 * Public support, privacy and complaints contact. Pending: the operator is setting up a domain
 * and mailbox. Store submission and public rollout are blocked until this is set.
 */
export const SUPPORT_EMAIL: string | null = null;
export const SUPPORT_PENDING_TEXT =
  'A support email address will be published here before public launch. Until then, you can withdraw or correct your reports and delete your account in the app.';

export const PUBLIC_SITE = 'https://civic263-df6ec.web.app';

/** Reviewed public text data only; photos are viewable but not licensed for reuse. */
export const DATA_LICENCE = {
  id: 'CC-BY-4.0',
  name: 'Creative Commons Attribution 4.0 International',
  url: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: `Civic263 public register, ${OPERATOR.name}`,
} as const;

/**
 * Emergency numbers as published by the UK government's travel advice for Zimbabwe. The
 * Zimbabwe government's own list could not be read (its site certificate is invalid), so these
 * are not yet confirmed by a Zimbabwean authority; confirming them is a launch blocker.
 */
export const EMERGENCY_GUIDANCE = {
  numbers: [
    { label: 'Police, fire or ambulance (Econet mobiles)', number: '112' },
    { label: 'Police, fire or ambulance (NetOne mobiles)', number: '114' },
    { label: 'From a landline (free)', number: '0800 3222 911' },
  ],
  source: 'UK government travel advice for Zimbabwe',
  sourceUrl: 'https://www.gov.uk/foreign-travel-advice/zimbabwe/getting-help',
  checkedOn: '2026-11-26',
  confirmedLocally: false,
} as const;
export const NOT_AN_EMERGENCY_SERVICE =
  'Civic263 does not contact emergency services and nobody watches reports around the clock. If anyone is in danger now, call for help first.';

/** Categories where a resident may be facing immediate danger; the app shows help numbers. */
export const DANGER_CATEGORIES: readonly CategoryId[] = [
  'dangerous-infrastructure',
  'road-obstruction',
  'stormwater',
  'streetlights',
];
export const isDangerCategory = (id: CategoryId) => DANGER_CATEGORIES.includes(id);

/**
 * Zimbabwe's outline (Natural Earth 1:110m, public domain) as [latitude, longitude] points.
 * It is coarse: real places such as Mutare, Beitbridge and Mount Selinda lie just outside it,
 * so pins within PILOT_MARGIN_KM of the outline are accepted too. A few places just across
 * the border (for example Livingstone or Musina) are therefore accepted; operators review
 * every report.
 */
const ZIMBABWE: readonly (readonly [number, number])[] = [
  [-22.2515, 31.1914],
  [-22.1516, 30.6599],
  [-22.2716, 30.3229],
  [-22.1022, 29.839],
  [-22.0913, 29.4322],
  [-21.6395, 28.7947],
  [-21.486, 28.0214],
  [-20.8518, 27.7272],
  [-20.4991, 27.7247],
  [-20.3915, 27.2965],
  [-19.2931, 26.1648],
  [-18.7144, 25.8504],
  [-18.536, 25.6492],
  [-17.7365, 25.2642],
  [-17.846, 26.3819],
  [-17.9612, 26.7068],
  [-17.938, 27.0444],
  [-17.2908, 27.5982],
  [-16.4684, 28.4679],
  [-16.3897, 28.8259],
  [-16.0431, 28.9475],
  [-15.6447, 29.5168],
  [-15.5078, 30.2743],
  [-15.8808, 30.339],
  [-15.8609, 31.1731],
  [-16.072, 31.6365],
  [-16.3194, 31.852],
  [-16.3921, 32.3282],
  [-16.7134, 32.8476],
  [-17.9791, 32.8499],
  [-18.6721, 32.6549],
  [-19.4194, 32.612],
  [-19.7156, 32.7727],
  [-20.3043, 32.6597],
  [-20.3953, 32.5087],
  [-21.1165, 32.245],
];
export const PILOT_AREA = 'Zimbabwe';
export const PILOT_MARGIN_KM = 35;
export const OUTSIDE_PILOT_MESSAGE =
  'Civic263 is piloting in Zimbabwe only. Move the pin to the place in Zimbabwe you are reporting.';

function insideOutline(latitude: number, longitude: number) {
  let inside = false;
  for (let i = 0, j = ZIMBABWE.length - 1; i < ZIMBABWE.length; j = i++) {
    const [lat1, lng1] = ZIMBABWE[i]!;
    const [lat2, lng2] = ZIMBABWE[j]!;
    if (
      lat1 > latitude !== lat2 > latitude &&
      longitude < ((lng2 - lng1) * (latitude - lat1)) / (lat2 - lat1) + lng1
    )
      inside = !inside;
  }
  return inside;
}
/** Distance in kilometres to the outline, on a local flat projection (accurate enough here). */
function kilometresToOutline(latitude: number, longitude: number) {
  const kx = Math.cos((latitude * Math.PI) / 180) * 111.32;
  const ky = 110.57;
  let best = Infinity;
  for (let i = 0, j = ZIMBABWE.length - 1; i < ZIMBABWE.length; j = i++) {
    const x1 = (ZIMBABWE[i]![1] - longitude) * kx;
    const y1 = (ZIMBABWE[i]![0] - latitude) * ky;
    const dx = (ZIMBABWE[j]![1] - longitude) * kx - x1;
    const dy = (ZIMBABWE[j]![0] - latitude) * ky - y1;
    const t = Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x1 + t * dx, y1 + t * dy));
  }
  return best;
}
export function isInPilotArea(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  // Cheap rejection far outside the region before the exact checks.
  if (latitude < -23.5 || latitude > -14.5 || longitude < 24.5 || longitude > 34) return false;
  return (
    insideOutline(latitude, longitude) ||
    kilometresToOutline(latitude, longitude) <= PILOT_MARGIN_KM
  );
}

/** What still blocks a public launch or store submission. Checked by `npm run check:launch`. */
export function launchBlockers(): string[] {
  return [
    ...(SUPPORT_EMAIL
      ? []
      : ['Set SUPPORT_EMAIL in packages/domain/src/pilot.ts once the support mailbox exists.']),
    ...(EMERGENCY_GUIDANCE.confirmedLocally
      ? []
      : [
          'Confirm the emergency numbers with a Zimbabwean authority (for example the ZRP or the government portal), then set confirmedLocally.',
        ]),
  ];
}
