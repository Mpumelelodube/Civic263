import assert from 'node:assert/strict';
import test from 'node:test';
import { CATEGORIES } from '../packages/domain/src/categories.ts';
import { categoryColor } from '../apps/mobile/src/category-colors.ts';

function luminance(hex: string) {
  const channels = [1, 3, 5]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
test('every service has distinct, visible pin colours in both appearances', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const surface = luminance(scheme === 'light' ? '#ffffff' : '#23364a');
    const colors = CATEGORIES.map((category) => categoryColor(category.id, scheme));
    assert.equal(new Set(colors).size, CATEGORIES.length);
    for (const color of colors) {
      const value = luminance(color);
      assert(
        (Math.max(surface, value) + 0.05) / (Math.min(surface, value) + 0.05) >= 3,
        `${scheme}: ${color}`,
      );
    }
  }
});
