export const CATEGORIES = [
  { id: 'roads', label: 'Roads and pavements' },
  { id: 'traffic-lights', label: 'Traffic lights / robots' },
  { id: 'road-signs', label: 'Road signs and markings' },
  { id: 'sewer', label: 'Sewer and sanitation' },
  { id: 'water', label: 'Water supply' },
  { id: 'stormwater', label: 'Stormwater and flooding' },
  { id: 'streetlights', label: 'Streetlights and electricity' },
  { id: 'waste', label: 'Waste and cleanliness' },
  { id: 'parks', label: 'Parks and public spaces' },
  { id: 'facilities', label: 'Public facilities' },
  { id: 'dangerous-infrastructure', label: 'Dangerous infrastructure' },
  { id: 'road-obstruction', label: 'Crash / road obstruction' },
  { id: 'other', label: 'Other municipal issue' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];
export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && CATEGORIES.some((category) => category.id === value);
}
export function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((category) => category.id === id)?.label ?? 'Other municipal issue';
}
