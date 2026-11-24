import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptiveLayout, windowClassFor } from '../apps/mobile/src/layout.ts';

test('phones stay single column with a bottom tab bar', () => {
  for (const width of [320, 360, 393, 430, 599]) {
    const layout = adaptiveLayout(width);
    assert.equal(layout.windowClass, 'compact');
    assert.equal(layout.columns, 1);
    assert.equal(layout.sidePanel, false);
    assert.equal(layout.navigationRail, false);
    assert.equal(layout.contentMaxWidth, width);
  }
});

test('iPad portrait, small tablets and unfolded foldables use two columns and a side panel', () => {
  for (const width of [600, 744, 820, 834, 839]) {
    const layout = adaptiveLayout(width);
    assert.equal(layout.windowClass, 'medium');
    assert.equal(layout.columns, 2);
    assert.equal(layout.sidePanel, true);
    assert.equal(layout.navigationRail, false);
    assert.ok(layout.wideContentMaxWidth <= width);
    assert.ok(layout.sidePanelWidth < width / 2);
  }
});

test('iPad landscape and large tablets get a navigation rail and wide content', () => {
  for (const width of [840, 1024, 1180, 1366]) {
    const layout = adaptiveLayout(width);
    assert.equal(layout.windowClass, 'expanded');
    assert.equal(layout.navigationRail, true);
    assert.equal(layout.sidePanel, true);
    assert.ok(layout.columns >= 2);
  }
  assert.equal(adaptiveLayout(1366).columns, 3);
  assert.equal(adaptiveLayout(1024).columns, 2);
});

test('split-screen widths change class at the boundaries', () => {
  assert.equal(windowClassFor(599), 'compact');
  assert.equal(windowClassFor(600), 'medium');
  assert.equal(windowClassFor(839), 'medium');
  assert.equal(windowClassFor(840), 'expanded');
});

test('the side panel never crowds out the map', () => {
  for (const width of [600, 744, 834, 1024, 1366]) {
    const layout = adaptiveLayout(width);
    assert.ok(width - layout.sidePanelWidth >= width * 0.55);
  }
});
