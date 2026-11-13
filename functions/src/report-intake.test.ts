import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { parseReportSubmission } from '../../packages/domain/src/report-submission.ts';
import { validatePhotos } from './report-intake.ts';

async function input() {
  const photos = [];
  for (const background of ['red', 'green', 'blue']) {
    const bytes = await sharp({ create: { width: 64, height: 48, channels: 3, background } })
      .withMetadata({ exif: { IFD0: { Artist: 'PRIVATE DEVICE DATA' } } })
      .jpeg()
      .toBuffer();
    photos.push({ id: randomUUID(), width: 64, height: 48, base64: bytes.toString('base64') });
  }
  return {
    submissionId: randomUUID(),
    categoryId: 'roads',
    description: 'TEST ONLY: a fictional issue.',
    landmark: 'TEST ONLY: no real location',
    location: { latitude: -17.8, longitude: 31, source: 'map' },
    photos,
  };
}

test('submission accepts zero to three photos, rejects four, and refuses client owner/workflow fields', async () => {
  const value = await input();
  assert.equal(parseReportSubmission(value).photos.length, 3);
  for (const count of [0, 1, 2])
    assert.equal(
      parseReportSubmission({ ...value, photos: value.photos.slice(0, count) }).photos.length,
      count,
    );
  assert.deepEqual(
    parseReportSubmission({ ...value, location: { latitude: -17.8, longitude: 31, source: 'map' } })
      .location,
    { latitude: -17.8, longitude: 31, source: 'map' },
  );
  assert.throws(
    () =>
      parseReportSubmission({
        ...value,
        location: { latitude: 999, longitude: 31, source: 'map' },
      }),
    /location/u,
  );
  assert.throws(
    () =>
      parseReportSubmission({
        ...value,
        photos: [...value.photos, { ...value.photos[0], id: randomUUID() }],
      }),
    /at most 3/u,
  );
  assert.throws(
    () => parseReportSubmission({ ...value, ownerUid: 'someone-else' }),
    /unsupported/u,
  );
  assert.throws(
    () => parseReportSubmission({ ...value, moderationStatus: 'approved' }),
    /unsupported/u,
  );
  assert.throws(
    () => parseReportSubmission({ ...value, photos: [value.photos[0], value.photos[0]] }),
    /invalid/u,
  );
  assert.throws(
    () =>
      parseReportSubmission({
        ...value,
        photos: [{ ...value.photos[0], base64: '?bad' }, ...value.photos.slice(1)],
      }),
    /invalid/u,
  );
  assert.throws(
    () =>
      parseReportSubmission({
        ...value,
        photos: [{ ...value.photos[0], width: 1601 }, ...value.photos.slice(1)],
      }),
    /invalid/u,
  );
});

test('server decodes JPEGs, rejects disguised or duplicate images, and strips private metadata', async () => {
  const value = parseReportSubmission(await input());
  const sanitized = await validatePhotos(value);
  assert.equal(sanitized.length, 3);
  for (const photo of sanitized) {
    const meta = await sharp(photo.bytes).metadata();
    assert.equal(meta.exif, undefined);
    assert.equal(meta.width, 64);
  }
  const first = value.photos[0]!;
  await assert.rejects(
    validatePhotos({
      ...value,
      photos: [{ ...first, base64: Buffer.from('not a photo').toString('base64') }],
    }),
    /JPEG/u,
  );
  await assert.rejects(validatePhotos({ ...value, photos: [{ ...first, width: 63 }] }), /decoded/u);
  await assert.rejects(
    validatePhotos({ ...value, photos: [first, { ...first, id: randomUUID() }] }),
    /different/u,
  );
});
