import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addWorkingDays,
  awaitingStaffReview,
  canRequestReview,
  complaintPriority,
  flagKey,
  parseComplaint,
  parsePublicText,
  parseReviewRequest,
  parseStaffCommand,
  shouldAutoHide,
} from './moderation.ts';
import { reviewExplanation, reviewLabel } from './resident-reports.ts';

const id = 'a'.repeat(40);
const check = 'b'.repeat(40);

test('reports held while automatic review is off wait for a person and say so', () => {
  const waiting = {
    moderationStatus: 'pending' as const,
    publicationStatus: 'hidden',
    reviewStatus: 'held' as const,
    reviewReason: 'staff-review' as const,
  };
  assert.equal(awaitingStaffReview(waiting), true);
  assert.equal(reviewLabel(waiting), 'Waiting for a person to review');
  assert.match(reviewExplanation(waiting) ?? '', /A person will check this report/);
  const decided = {
    ...waiting,
    staffDecision: {
      status: 'kept-private' as const,
      decidedAt: '2026-11-26T10:00:00.000Z',
      reason: 'duplicate' as const,
      note: 'See the earlier report.',
    },
  };
  assert.equal(awaitingStaffReview(decided), false);
  assert.equal(reviewLabel(decided), 'Kept private after human review');
  assert.equal(
    reviewExplanation(decided),
    'A reviewer kept it private. The same issue is already on the public register. See the earlier report.',
  );
  // Automatic holds keep their existing wording.
  const automatic = { ...waiting, reviewReason: 'privacy' as const };
  assert.equal(awaitingStaffReview(automatic), false);
  assert.equal(reviewLabel(automatic), 'Kept private after automatic review');
  assert.equal(awaitingStaffReview({ ...waiting, publicationStatus: 'published' }), false);
});

test('response deadlines count working days only', () => {
  // Friday 27 November 2026 -> Tuesday 1 December 2026.
  assert.equal(
    addWorkingDays(new Date('2026-11-27T10:00:00Z'), 2).toISOString(),
    '2026-12-01T10:00:00.000Z',
  );
  // Saturday counts from the next Monday.
  assert.equal(
    addWorkingDays(new Date('2026-11-28T10:00:00Z'), 2).toISOString(),
    '2026-12-01T10:00:00.000Z',
  );
  assert.equal(
    addWorkingDays(new Date('2026-11-24T10:00:00Z'), 2).toISOString(),
    '2026-11-26T10:00:00.000Z',
  );
});

test('only an unappealed held report that is not a test can be appealed', () => {
  const held = {
    moderationStatus: 'pending' as const,
    publicationStatus: 'hidden',
    workflowStatus: 'received' as const,
    reviewStatus: 'held',
  };
  assert.equal(canRequestReview(held), true);
  assert.equal(canRequestReview({ ...held, reviewStatus: 'queued' }), false);
  assert.equal(canRequestReview({ ...held, publicationStatus: 'published' }), false);
  assert.equal(canRequestReview({ ...held, moderationStatus: 'withdrawn' }), false);
  assert.equal(canRequestReview({ ...held, workflowStatus: 'resolved' }), false);
  assert.equal(canRequestReview({ ...held, testOnly: true }), false);
  assert.equal(canRequestReview({ ...held, appeal: { status: 'kept-private' } }), false);
  // A report that waited for a person (automatic review off) is already in front of one.
  assert.equal(canRequestReview({ ...held, reviewReason: 'staff-review' }), false);
  assert.deepEqual(parseReviewRequest({ action: 'request-review', reportId: id, note: '  ' }), {
    reportId: id,
  });
  assert.throws(() =>
    parseReviewRequest({ action: 'request-review', reportId: id, note: 'x'.repeat(501) }),
  );
});

test('complaints name one public item and a known reason', () => {
  assert.deepEqual(
    parseComplaint({
      action: 'report-concern',
      target: { type: 'photo', reportId: id, index: 1 },
      reason: 'unsafe',
    }),
    { target: { type: 'photo', reportId: id, index: 1 }, reason: 'unsafe' },
  );
  for (const target of [
    { type: 'photo', reportId: id, index: 6 },
    { type: 'photo', reportId: id },
    { type: 'issue', reportId: id, extra: true },
    { type: 'check', reportId: id, checkId: 'C263' },
    { type: 'person', reportId: id },
  ])
    assert.throws(() => parseComplaint({ action: 'report-concern', target, reason: 'offensive' }));
  assert.throws(() =>
    parseComplaint({
      action: 'report-concern',
      target: { type: 'issue', reportId: id },
      reason: 'boring',
    }),
  );
  assert.equal(flagKey({ type: 'issue', reportId: id }), id);
  assert.equal(flagKey({ type: 'photo', reportId: id, index: 0 }, 2), `${id}_photo_2`);
  assert.equal(flagKey({ type: 'check', reportId: id, checkId: check }), `${id}_check_${check}`);
});

test('three new distinct reporters hide content; personal information and danger come first', () => {
  assert.equal(shouldAutoHide({ status: 'visible', reporters: 2, baseline: 0 }), false);
  assert.equal(shouldAutoHide({ status: 'visible', reporters: 3, baseline: 0 }), true);
  assert.equal(shouldAutoHide({ status: 'restored', reporters: 5, baseline: 3 }), false);
  assert.equal(shouldAutoHide({ status: 'restored', reporters: 6, baseline: 3 }), true);
  assert.equal(shouldAutoHide({ status: 'removed', reporters: 9, baseline: 0 }), false);
  assert.equal(complaintPriority({ offensive: 4 }), 'normal');
  assert.equal(complaintPriority({ offensive: 1, 'personal-information': 1 }), 'high');
  assert.equal(complaintPriority({ unsafe: 1 }), 'high');
});

test('operator commands are strict and operator text cannot carry contact details', () => {
  const text = {
    title: 'Burst pipe',
    summary: 'Water is leaking across the road.',
    area: 'Avondale',
  };
  assert.deepEqual(parsePublicText(text), text);
  assert.throws(
    () => parsePublicText({ ...text, summary: 'Call +263 77 123 4567 now' }),
    /contact/,
  );
  assert.throws(() => parsePublicText({ ...text, title: 'Pipe' }), /title/);
  const publish = parseStaffCommand({
    action: 'staff-publish',
    reportId: id,
    photos: [2, 0],
    ...text,
  });
  assert.deepEqual(publish, { action: 'staff-publish', reportId: id, photos: [0, 2], ...text });
  assert.throws(() =>
    parseStaffCommand({ action: 'staff-publish', reportId: id, photos: [3], ...text }),
  );
  assert.throws(() =>
    parseStaffCommand({ action: 'staff-keep-private', reportId: id, reason: 'boring' }),
  );
  assert.throws(() => parseStaffCommand({ action: 'staff-block', reportId: id, note: '' }), /why/);
  assert.throws(() =>
    parseStaffCommand({
      action: 'staff-resolve-complaint',
      key: `${id}_photo_9`,
      outcome: 'remove',
    }),
  );
  assert.deepEqual(parseStaffCommand({ action: 'staff-queue', queue: 'held' }), {
    action: 'staff-queue',
    queue: 'held',
  });
  assert.throws(() => parseStaffCommand({ action: 'staff-delete-everything' }));
});
