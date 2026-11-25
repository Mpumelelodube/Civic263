import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_REPORT_CORRECTIONS,
  canCorrectReport,
  canWithdrawReport,
  parseAccountDeletion,
  parseReportCorrection,
  parseWithdrawal,
  withdrawalOutcome,
} from './account-lifecycle.ts';

const id = 'a'.repeat(40);
const correction = {
  action: 'correct-report',
  reportId: id,
  revision: 0,
  categoryId: 'roads',
  description: '  Deep pothole across the left lane  ',
  landmark: ' Near the bus stop ',
  location: { latitude: -17.82, longitude: 31.03, source: 'map' },
  keepPhotos: [2, 0],
};

test('withdrawal keeps a public issue only when another resident added evidence', () => {
  assert.equal(withdrawalOutcome({ published: false, otherEvidence: false }), 'private');
  assert.equal(withdrawalOutcome({ published: false, otherEvidence: true }), 'private');
  assert.equal(withdrawalOutcome({ published: true, otherEvidence: false }), 'unpublished');
  assert.equal(withdrawalOutcome({ published: true, otherEvidence: true }), 'retained');
  assert.equal(canWithdrawReport({ moderationStatus: 'approved' }), true);
  assert.equal(canWithdrawReport({ moderationStatus: 'withdrawn' }), false);
});

test('corrections are limited to unpublished reports that are not under review', () => {
  const held = {
    moderationStatus: 'pending' as const,
    publicationStatus: 'hidden',
    workflowStatus: 'received' as const,
    reviewStatus: 'held',
    correctionCount: 0,
  };
  assert.equal(canCorrectReport(held), true);
  assert.equal(canCorrectReport({ ...held, reviewStatus: 'queued' }), true);
  assert.equal(canCorrectReport({ ...held, reviewStatus: 'retrying' }), true);
  assert.equal(canCorrectReport({ ...held, reviewStatus: 'processing' }), false);
  assert.equal(canCorrectReport({ ...held, publicationStatus: 'published' }), false);
  assert.equal(canCorrectReport({ ...held, moderationStatus: 'approved' }), false);
  assert.equal(canCorrectReport({ ...held, moderationStatus: 'withdrawn' }), false);
  assert.equal(canCorrectReport({ ...held, workflowStatus: 'resolved' }), false);
  assert.equal(canCorrectReport({ ...held, correctionCount: MAX_REPORT_CORRECTIONS }), false);
});

test('correction commands are strict, trimmed and keep photos in stored order', () => {
  const parsed = parseReportCorrection(correction);
  assert.equal(parsed.description, 'Deep pothole across the left lane');
  assert.equal(parsed.landmark, 'Near the bus stop');
  assert.deepEqual(parsed.keepPhotos, [0, 2]);
  assert.throws(() => parseReportCorrection({ ...correction, photos: [] }), /unsupported/);
  assert.throws(() => parseReportCorrection({ ...correction, revision: -1 }), /Refresh/);
  assert.throws(
    () => parseReportCorrection({ ...correction, description: 'short' }),
    /10 to 1,000/,
  );
  assert.throws(() => parseReportCorrection({ ...correction, keepPhotos: [0, 0] }), /photos/);
  assert.throws(() => parseReportCorrection({ ...correction, keepPhotos: [3] }), /photos/);
  assert.throws(() => parseReportCorrection({ ...correction, location: undefined }), /pin/);
  assert.throws(
    () => parseReportCorrection({ ...correction, reportId: 'C263-ABC' }),
    /valid report/,
  );
});

test('withdrawal and deletion commands accept only their exact fields', () => {
  assert.deepEqual(parseWithdrawal({ action: 'withdraw-report', reportId: id }), { reportId: id });
  assert.throws(() => parseWithdrawal({ action: 'withdraw-report', reportId: id, all: true }));
  assert.deepEqual(parseAccountDeletion({ action: 'delete-account', confirm: 'DELETE' }), {
    confirm: 'DELETE',
  });
  assert.throws(() => parseAccountDeletion({ action: 'delete-account' }), /Confirm/);
  assert.throws(() => parseAccountDeletion({ action: 'delete-account', confirm: 'yes' }));
});
