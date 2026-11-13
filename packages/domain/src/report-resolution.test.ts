import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkResolutionEvidence,
  checkResolutionPosition,
  parseResolutionCommand,
  readResolution,
} from './report-resolution.ts';
import { parseReportSubmission } from './report-submission.ts';

const now = Date.now();
const anchor = { latitude: -17.8, longitude: 31 };
const fix = { ...anchor, timestamp: now, accuracyMeters: 5, mocked: false };
const photo = {
  id: '00000000-0000-4000-8000-000000000001',
  base64: '/9j/',
  width: 1,
  height: 1,
  captureSource: 'camera',
  capturedAt: now,
  location: fix,
};
const input = {
  action: 'resolve',
  reportId: 'a'.repeat(40),
  attemptId: '00000000-0000-4000-8000-000000000002',
  location: fix,
  photos: [photo],
};

test('resolution requires 1–3 camera photos and rejects extra fields, duplicate photos and gallery claims', () => {
  const command = parseResolutionCommand(input);
  checkResolutionEvidence(command, anchor, now);
  for (const photos of [
    [],
    [photo, photo],
    Array(4).fill(photo),
    [{ ...photo, captureSource: 'gallery' }],
    [{ ...photo, capturedAt: NaN }],
    [{ ...photo, ownerUid: 'forged' }],
  ])
    assert.throws(() => parseResolutionCommand({ ...input, photos }));
  assert.throws(() => parseResolutionCommand({ action: 'resolve', reportId: input.reportId }));
});

test('resolution uses the private pin with a strict 20m radius and bounded device accuracy', () => {
  assert.equal(checkResolutionPosition(fix, anchor, now), 0);
  assert(
    checkResolutionPosition({ ...fix, latitude: anchor.latitude + 19.9 / 111195 }, anchor, now) <
      20,
  );
  assert.throws(
    () =>
      checkResolutionPosition({ ...fix, latitude: anchor.latitude + 20.1 / 111195 }, anchor, now),
    /within 20/,
  );
  for (const accuracyMeters of [0, -1, 20.1, Infinity, NaN])
    assert.throws(
      () => checkResolutionPosition({ ...fix, accuracyMeters }, anchor, now),
      /accurate/,
    );
  assert.throws(() => checkResolutionPosition({ ...fix, mocked: true }, anchor, now), /mocked/);
  assert.throws(() => checkResolutionPosition(fix, null, now), /no saved pin/);
});

test('resolution rejects stale/future fixes and expired or badly timed captures', () => {
  for (const timestamp of [now - 120001, now + 15001])
    assert.throws(() => checkResolutionPosition({ ...fix, timestamp }, anchor, now), /fresh GPS/);
  const command = parseResolutionCommand(input);
  for (const capturedAt of [now - 600001, now + 15001, now - 30001])
    assert.throws(
      () =>
        checkResolutionEvidence(
          { ...command, photos: [{ ...command.photos[0]!, capturedAt }] },
          anchor,
          now,
        ),
      /new photos/,
    );
  assert.throws(
    () =>
      checkResolutionEvidence(
        {
          ...command,
          photos: [
            { ...command.photos[0]!, location: { ...fix, latitude: anchor.latitude + 0.001 } },
          ],
        },
        anchor,
        now,
      ),
    /within 20/,
  );
});

test('public resolution evidence is allowlisted; old resolutions stay readable', () => {
  const resolution = { source: 'resident', resolvedAt: new Date(now).toISOString() };
  assert.deepEqual(
    readResolution({ ...resolution, ownerUid: 'PRIVATE', location: fix }),
    resolution,
  );
  assert.deepEqual(
    readResolution({
      ...resolution,
      evidenceStatus: 'pending',
      photoCount: 3,
      rawMediaPaths: ['PRIVATE'],
    }),
    { ...resolution, evidenceStatus: 'pending', photoCount: 0 },
  );
  assert.equal(
    readResolution({ ...resolution, evidenceStatus: 'published', photoCount: 4 })?.photoCount,
    0,
  );
});

test('new report submissions require a confirmed pin, while initial photos remain optional', () => {
  const report = {
    submissionId: input.attemptId,
    categoryId: 'roads',
    description: 'TEST ONLY: fictional road issue.',
    landmark: 'TEST ONLY fixture',
    photos: [],
  };
  assert.throws(() => parseReportSubmission(report), /Confirm a report pin/);
  assert.equal(
    parseReportSubmission({ ...report, location: { ...anchor, source: 'map' } }).photos.length,
    0,
  );
});
