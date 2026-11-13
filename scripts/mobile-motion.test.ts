import assert from 'node:assert/strict';
import test from 'node:test';
import { sheetSnap } from '../apps/mobile/src/components/sheet-snap.ts';

test('sheet snaps to the nearest resting point after a slow drag', () => {
  assert.equal(sheetSnap(20, 0, 300, 700), 'expanded');
  assert.equal(sheetSnap(280, 0, 300, 700), 'collapsed');
  assert.equal(sheetSnap(500, 0, 300, 700), 'dismiss');
});
test('a short fast flick commits in its direction', () => {
  assert.equal(sheetSnap(280, -700, 300, 700), 'expanded');
  assert.equal(sheetSnap(310, 700, 300, 700), 'dismiss');
});
