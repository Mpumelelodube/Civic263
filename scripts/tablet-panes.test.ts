import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReportDraft, ResidentReport } from '@civic263/domain';
import { countReportGroups, reportGroup } from '../apps/mobile/src/services/report-history.ts';
import { reportReadiness } from '../apps/mobile/src/services/report-readiness.ts';

const draft = (receipt = false) =>
  ({
    kind: 'draft',
    item: { id: 'd', ...(receipt ? { receipt: { reportId: 'r' } } : {}) } as unknown as ReportDraft,
  }) as const;
const cloud = (workflowStatus: string) =>
  ({ kind: 'cloud', item: { id: 'c', workflowStatus } as unknown as ResidentReport }) as const;

test('My reports filters group drafts, submitted and resolved reports', () => {
  assert.equal(reportGroup(draft()), 'drafts');
  assert.equal(reportGroup(draft(true)), 'submitted');
  assert.equal(reportGroup(cloud('received')), 'submitted');
  assert.equal(reportGroup(cloud('resolution-pending')), 'submitted');
  assert.equal(reportGroup(cloud('resolved')), 'resolved');
  assert.deepEqual(
    countReportGroups([draft(), draft(true), cloud('resolved'), cloud('received')]),
    {
      all: 4,
      drafts: 1,
      submitted: 2,
      resolved: 1,
    },
  );
});

test('the composer checklist mirrors the draft rules', () => {
  const base = {
    categoryId: 'roads' as const,
    description: '',
    landmark: '',
    hasPin: false,
    photoCount: 0,
  };
  const empty = reportReadiness(base);
  assert.equal(empty.ready, false);
  assert.equal(
    empty.items.find((item) => item.key === 'description')?.detail,
    'Add at least 10 characters',
  );
  const short = reportReadiness({ ...base, description: 'Pothole' });
  assert.equal(
    short.items.find((item) => item.key === 'description')?.detail,
    '3 more characters needed',
  );
  const unpinned = reportReadiness({ ...base, description: 'A deep pothole', landmark: 'Main St' });
  assert.equal(unpinned.ready, false);
  assert.equal(unpinned.items.find((item) => item.key === 'place')?.detail, 'Confirm a map pin');
  const ready = reportReadiness({
    ...base,
    description: 'A deep pothole',
    landmark: 'Main St',
    hasPin: true,
  });
  assert.equal(ready.ready, true, 'photos are optional');
  const abroad = reportReadiness({
    ...base,
    description: 'A deep pothole',
    landmark: 'Main St',
    hasPin: true,
    pinInPilotArea: false,
  });
  assert.equal(abroad.ready, false, 'a pin outside the pilot area cannot be sent');
  assert.equal(
    abroad.items.find((item) => item.key === 'place')?.detail,
    'Move the pin into Zimbabwe',
  );
  const tooLong = reportReadiness({
    ...base,
    description: 'x'.repeat(1001),
    landmark: 'a',
    hasPin: true,
  });
  assert.equal(tooLong.ready, false);
});
