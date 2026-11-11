import type { CategoryId, HandoffStatus, PublicIncident, WorkflowStatus } from '@civic263/domain';

export const DEMO_AS_OF = '2026-11-09T08:00:00.000Z';
type Example = [string, string, CategoryId, WorkflowStatus, HandoffStatus, number, number];
const examples: Example[] = [
  ['Pothole on Samora Machel Avenue', 'CBD', 'roads', 'received', 'not-sent', 19, 2],
  ['Sewer overflow near the market', 'Mbare', 'sewer', 'received', 'failed', 8, 1],
  [
    'Traffic lights out at an intersection',
    'Southerton',
    'traffic-lights',
    'assigned',
    'acknowledged',
    4,
    1,
  ],
  ['Water leak beside a public footpath', 'Mufakose', 'water', 'in-progress', 'sent', 3, 3],
  ['Uncollected waste at a public site', 'Highfield', 'waste', 'received', 'not-sent', 10, 8],
  ['Blocked storm drain after rain', 'Belvedere', 'stormwater', 'received', 'not-sent', 1, 0],
  [
    'Streetlight repaired beside the shops',
    'Avondale',
    'streetlights',
    'resolved',
    'acknowledged',
    5,
    1,
  ],
  ['Road edge repaired near bus stop', 'Warren Park', 'roads', 'closed', 'acknowledged', 14, 2],
];
function daysAgo(days: number): string {
  return new Date(Date.parse(DEMO_AS_OF) - days * 86_400_000).toISOString();
}
export const DEMO_INCIDENTS: PublicIncident[] = examples.map(
  ([title, area, categoryId, workflowStatus, handoffStatus, age, freshness], index) => ({
    id: `demo-${index + 1}`,
    reference: `ISS-DEMO-${String(index + 1).padStart(2, '0')}`,
    municipalityId: 'demo-harare',
    title,
    summary:
      'Fictional design example. This is not an actual fault, inspection, council response or repair.',
    categoryId,
    area,
    workflowStatus,
    handoffStatus,
    firstAcceptedAt: daysAgo(age),
    lastApprovedEvidenceAt: daysAgo(freshness),
    evidenceSource: 'resident-observation',
    location: null,
    locationPrecision: 'hidden',
    publicationVersion: 1,
  }),
);

// Relative diagram positions are separate from the geographic domain model.
// These are NOT real map coordinates and are never included in exports.
export const DEMO_POSITIONS = [
  [54, 29],
  [63, 72],
  [47, 60],
  [20, 54],
  [35, 78],
  [38, 36],
  [49, 15],
  [17, 32],
] as const;
export function ageInDays(timestamp: string | null): string {
  if (!timestamp) return 'Unknown';
  const days = Math.max(
    0,
    Math.floor((Date.parse(DEMO_AS_OF) - Date.parse(timestamp)) / 86_400_000),
  );
  return days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} ago`;
}
