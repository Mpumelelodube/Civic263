import type { CategoryId } from '@civic263/domain';

// The icon and category name remain the primary cues; colour also helps scan the map.
const colors = {
  roads: { light: '#965A08', dark: '#F1C46E' },
  'traffic-lights': { light: '#AD482F', dark: '#FFAA91' },
  'road-signs': { light: '#876408', dark: '#DFCE72' },
  sewer: { light: '#8054A3', dark: '#C6ACEE' },
  water: { light: '#176BB1', dark: '#8FC9FF' },
  stormwater: { light: '#007B83', dark: '#75D7DE' },
  streetlights: { light: '#8E6600', dark: '#F4D876' },
  waste: { light: '#657125', dark: '#C5D788' },
  parks: { light: '#28734D', dark: '#91D8AA' },
  facilities: { light: '#525FA8', dark: '#AEBBFF' },
  'dangerous-infrastructure': { light: '#B53D4E', dark: '#FF9FAF' },
  'road-obstruction': { light: '#A95721', dark: '#FFBC88' },
  other: { light: '#596C7A', dark: '#C0CED8' },
} satisfies Record<CategoryId, { light: string; dark: string }>;

export function categoryColor(categoryId: CategoryId, scheme: 'light' | 'dark') {
  return colors[categoryId][scheme];
}
