import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReview, photoClearedByVision } from './automatic-review.ts';
import { reportRequest, toResidentReport } from './report-access.ts';

test('automatic publication requires confident, contact-free text and valid photo indexes', () => {
  const eligible = {
    publish: true,
    confidence: 0.98,
    reason: 'eligible',
    title: 'Water leak at roadside',
    summary: 'A resident reports water flowing from a roadside pipe.',
    area: 'Avondale',
    safePhotos: [0, 2],
  };
  assert.equal(parseReview(eligible, 3).publish, true);
  assert.equal(parseReview({ ...eligible, safePhotos: [] }, 0).publish, true);
  assert.throws(() => parseReview({ ...eligible, safePhotos: [0] }, 0));
  assert.equal(parseReview({ ...eligible, confidence: 0.94 }, 3).publish, false);
  assert.equal(
    parseReview({ ...eligible, summary: 'Contact resident on +263 771 234 567' }, 3).reason,
    'privacy',
  );
  assert.equal(parseReview({ ...eligible, area: 'person@example.com' }, 3).publish, false);
  assert.equal(parseReview({ ...eligible, reason: 'uncertain' }, 3).publish, false);
  for (const indexes of [[-1], [3], [0, 0], [0.5], ['0']])
    assert.throws(() => parseReview({ ...eligible, safePhotos: indexes }, 3));
});

test('photo checks fail closed on faces, readable text, incomplete or unsafe responses', () => {
  const clean = {
    safeSearchAnnotation: { adult: 'VERY_UNLIKELY', violence: 'UNLIKELY', racy: 'VERY_UNLIKELY' },
  };
  assert.equal(photoClearedByVision(clean), true);
  for (const result of [
    {},
    { ...clean, error: { code: 500 } },
    { ...clean, faceAnnotations: [{}] },
    { ...clean, textAnnotations: [{ description: 'ABC 1234' }] },
    { safeSearchAnnotation: { ...clean.safeSearchAnnotation, adult: 'POSSIBLE' } },
  ])
    assert.equal(photoClearedByVision(result), false);
});

test('resident responses explicitly project owner fields and validate report identifiers', () => {
  const data = {
    receipt: { reference: 'C263-ABC' },
    categoryId: 'water',
    description: 'A leaking pipe.',
    landmark: 'Nearby road',
    createdAt: new Date().toISOString(),
    moderationStatus: 'pending',
    publicationStatus: 'hidden',
    workflowStatus: 'received',
    rawMediaPaths: ['private/secret.jpg'],
    ownerUid: 'private-owner',
    internalNotes: 'private staff note',
    reviewLease: 'private-lease',
  };
  const record = toResidentReport({ id: 'a'.repeat(40), data: () => data } as unknown as Parameters<
    typeof toResidentReport
  >[0]);
  assert.equal(record.photoCount, 1);
  assert.equal(record.reviewStatus, 'queued');
  assert.equal(JSON.stringify(record).includes('private-'), false);
  assert.equal(JSON.stringify(record).includes('private/'), false);
  assert.equal(reportRequest({}, 'cursor', true), null);
  assert.equal(reportRequest({ reportId: 'a'.repeat(40) }, 'reportId'), 'a'.repeat(40));
  assert.throws(() => reportRequest({ reportId: '../private' }, 'reportId'));
  assert.throws(() => reportRequest({ reportId: 'a'.repeat(40), ownerUid: 'other' }, 'reportId'));
});
