import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptiveLayout,
  navigationFor,
  RAIL_WIDTH,
  SIDEBAR_WIDTH,
  windowClassFor,
} from '../apps/mobile/src/layout.ts';

const inside = { insideNavigation: true };

test('phones keep bottom tabs and a single column', () => {
  for (const width of [320, 360, 393, 430, 599]) {
    const layout = adaptiveLayout(width, inside);
    assert.equal(layout.windowClass, 'compact');
    assert.equal(layout.navigation, 'tabs');
    assert.equal(layout.navWidth, 0);
    assert.equal(layout.columns, 1);
    assert.equal(layout.listDetail, false);
    assert.equal(layout.summaryColumn, false);
    assert.equal(layout.contentMaxWidth, width);
  }
});

test('iPad portrait, iPad mini and unfolded foldables use a rail with list/detail', () => {
  for (const width of [744, 820, 834, 884, 999]) {
    const layout = adaptiveLayout(width, inside);
    assert.equal(layout.navigation, 'rail');
    assert.equal(layout.navWidth, RAIL_WIDTH);
    assert.equal(layout.contentWidth, width - RAIL_WIDTH);
    assert.equal(layout.listDetail, true);
  }
});

test('iPad landscape and large tablets use a full sidebar', () => {
  for (const width of [1024, 1133, 1180, 1366]) {
    const layout = adaptiveLayout(width, inside);
    assert.equal(layout.navigation, 'sidebar');
    assert.equal(layout.navWidth, SIDEBAR_WIDTH);
    assert.equal(layout.listDetail, true);
    assert.equal(layout.summaryColumn, true);
  }
});

test('screens outside the tab navigator get the whole window', () => {
  const layout = adaptiveLayout(1180);
  assert.equal(layout.navWidth, 0);
  assert.equal(layout.contentWidth, 1180);
});

test('size classes and navigation change at their boundaries', () => {
  assert.equal(windowClassFor(599), 'compact');
  assert.equal(windowClassFor(600), 'medium');
  assert.equal(windowClassFor(839), 'medium');
  assert.equal(windowClassFor(840), 'expanded');
  assert.equal(navigationFor(599), 'tabs');
  assert.equal(navigationFor(600), 'rail');
  assert.equal(navigationFor(999), 'rail');
  assert.equal(navigationFor(1000), 'sidebar');
});

test('list/detail always leaves the detail pane at least 340 points', () => {
  for (const width of [744, 820, 884, 1024, 1180, 1366]) {
    const layout = adaptiveLayout(width, inside);
    assert.ok(layout.listDetail);
    assert.ok(layout.contentWidth - layout.listPaneWidth >= 340, `width ${width}`);
    assert.ok(layout.listPaneWidth >= 300 && layout.listPaneWidth <= 400);
  }
});

test('the map inspector never covers more than half of the map', () => {
  for (const width of [744, 820, 1024, 1366]) {
    const layout = adaptiveLayout(width, inside);
    assert.ok(layout.listPaneWidth <= layout.contentWidth / 2 + 24, `width ${width}`);
  }
});
