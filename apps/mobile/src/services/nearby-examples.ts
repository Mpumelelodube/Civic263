import { distanceKm, type IssueLocation } from '@civic263/domain';

export const DEMO_CENTRE = { latitude: -17.8252, longitude: 31.0335 };
// Fictional map examples, never mixed into a live reporting source.
const examples = [
  {
    id: 'demo-road',
    categoryId: 'roads',
    title: 'Road surface damage',
    service: 'Roads',
    latitude: -17.821,
    longitude: 31.041,
  },
  {
    id: 'demo-water',
    categoryId: 'water',
    title: 'Water leak beside a footpath',
    service: 'Water',
    latitude: -17.839,
    longitude: 31.025,
  },
  {
    id: 'demo-drain',
    categoryId: 'stormwater',
    title: 'Blocked stormwater drain',
    service: 'Stormwater',
    latitude: -17.812,
    longitude: 31.018,
  },
  {
    id: 'demo-waste',
    categoryId: 'waste',
    title: 'Waste awaiting collection',
    service: 'Waste',
    latitude: -17.868,
    longitude: 31.002,
  },
  {
    id: 'demo-light',
    categoryId: 'streetlights',
    title: 'Streetlight out',
    service: 'Streetlights',
    latitude: -17.778,
    longitude: 31.061,
  },
] as const;

export function nearbyExamples(centre: IssueLocation) {
  return examples
    .map((issue) => ({ ...issue, distance: distanceKm(centre, issue) }))
    .filter((issue) => issue.distance <= 5)
    .sort((a, b) => a.distance - b.distance);
}
