import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
const sharp = createRequire(new URL('../functions/package.json', import.meta.url))('sharp');

// Fixed demo project and loopback services: these fixtures can never reach production.
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = 'demo-civic263';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
initializeApp({ projectId: 'demo-civic263', storageBucket: 'demo-civic263.appspot.com' });
const { reviewSubmittedReport } = await import('../functions/src/automatic-review.ts');
const { servePublicApi } = await import('../functions/src/public-api.ts');
const { readResidentReport } = await import('../functions/src/report-access.ts');
const { reviewResolutionEvidence } = await import('../functions/src/resolution-review.ts');
const { toPublicIncident } = await import('../packages/domain/src/publication.ts');
const sdkRequire = createRequire(import.meta.resolve('firebase-functions/v2/https'));
const express = sdkRequire('express');
const app = express();
app.use(servePublicApi);
const server = await new Promise((resolve) => {
  const current = app.listen(0, '127.0.0.1', () => resolve(current));
});
const base = `http://127.0.0.1:${server.address().port}`;
const db = getFirestore();
const bucket = getStorage().bucket();
const ownerUid = `publication-test-${randomUUID()}`;

async function fixture(testOnly = false) {
  const id = createHash('sha256').update(randomUUID()).digest('hex').slice(0, 40);
  const rawMediaPaths = [];
  for (const background of ['red', 'green', 'blue']) {
    const path = `private/reports/${ownerUid}/${id}/${randomUUID()}.jpg`;
    const bytes = await sharp({ create: { width: 80, height: 60, channels: 3, background } })
      .withMetadata({ exif: { IFD0: { Artist: 'PRIVATE TEST METADATA' } } })
      .jpeg()
      .toBuffer();
    await bucket
      .file(path)
      .save(bytes, { resumable: false, metadata: { contentType: 'image/jpeg' } });
    rawMediaPaths.push(path);
  }
  await db
    .collection('reports')
    .doc(id)
    .set({
      ownerUid,
      categoryId: 'roads',
      description: 'EMULATOR FIXTURE ONLY - not a real issue.',
      landmark: 'EMULATOR FIXTURE LOCATION',
      location: { latitude: -17.825234, longitude: 31.033617, source: 'map' },
      rawMediaPaths,
      moderationStatus: 'pending',
      publicationStatus: 'hidden',
      workflowStatus: 'received',
      handoffStatus: 'not-sent',
      reviewStatus: 'queued',
      createdAt: new Date().toISOString(),
      receipt: {
        testOnly,
        reportId: id,
        reference: `C263-${id.slice(0, 12).toUpperCase()}`,
        photoCount: 3,
        receivedAt: new Date().toISOString(),
      },
    });
  return id;
}
const decision = {
  publish: true,
  reason: 'eligible',
  title: 'EMULATOR FIXTURE - road damage',
  summary: 'EMULATOR FIXTURE ONLY: a synthetic resident observation for isolated validation.',
  area: 'EMULATOR FIXTURE AREA',
  safePhotos: [1],
};
try {
  const id = await fixture();
  const results = await Promise.allSettled([
    reviewSubmittedReport(id, async () => decision),
    reviewSubmittedReport(id, async () => decision),
  ]);
  assert(results.some((item) => item.status === 'fulfilled'));
  await reviewSubmittedReport(id, async () => {
    throw new Error('Completed review must not call the provider again');
  });
  const report = (await db.collection('reports').doc(id).get()).data();
  assert.equal(report.reviewStatus, 'published');
  assert.equal(report.moderationStatus, 'approved');
  assert.equal(report.workflowStatus, 'received');
  assert.equal(report.handoffStatus, 'not-sent');
  const published = (await db.collection('publicIncidents').doc(id).get()).data();
  assert.equal(published.photoCount, 1);
  assert.deepEqual(published.location, { latitude: -17.825, longitude: 31.034 });
  assert.equal(published.locationPrecision, 'approximate');
  assert.equal(published.reviewMethod, 'automated');
  assert.equal(published.lastApprovedEvidenceAt, report.receipt.receivedAt);
  for (const field of [
    'ownerUid',
    'rawMediaPaths',
    'internalNotes',
    'receipt',
    'reviewLease',
    'approvedPhotoIndexes',
  ])
    assert.equal(field in published, false);
  const detail = await readResidentReport({ reportId: id }, ownerUid);
  assert.equal(detail.photos.length, 3);
  await assert.rejects(readResidentReport({ reportId: id }, 'different-owner'), {
    code: 'not-found',
  });
  const publicDetail = await fetch(`${base}/incidents/${id}`);
  assert.equal(publicDetail.status, 200);
  assert.deepEqual(await publicDetail.json(), published);
  const photo = await fetch(`${base}/incidents/${id}/photos/0`);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/jpeg');
  const bytes = Buffer.from(await photo.arrayBuffer());
  assert.equal(bytes.includes(Buffer.from('PRIVATE TEST METADATA')), false);
  assert.equal((await sharp(bytes).metadata()).exif, undefined);
  assert.equal((await fetch(`${base}/incidents/${id}/photos/1`)).status, 404);
  const nearby = await fetch(`${base}/incidents?lat=-17.825&lng=31.034`).then((response) =>
    response.json(),
  );
  assert(nearby.incidents.some((item) => item.id === id));
  assert.equal((await fetch(`${base}/incidents?cursor=../../private`)).status, 400);
  console.log(
    'PASS: idempotent publication, public allowlist, approximate location, approved derivative and owner originals',
  );

  // Legacy archived records remain readable after the community workflow replaces owner-only closure.
  const resolution = { source: 'resident', resolvedAt: new Date().toISOString() };
  const incident = (await db.collection('incidents').doc(id).get()).data();
  await db.collection('reports').doc(id).update({ workflowStatus: 'resolved', resolution });
  const archived = {
    ...incident,
    workflowStatus: 'resolved',
    resolution,
    publicationVersion: incident.publicationVersion + 1,
  };
  await db.collection('incidents').doc(id).set(archived);
  await db.collection('publicIncidents').doc(id).set(toPublicIncident(archived));
  assert.equal((await fetch(`${base}/incidents/${id}`)).status, 200);
  assert.equal((await fetch(`${base}/incidents/${id}/photos/0`)).status, 200);
  const nearbyAfter = await fetch(`${base}/incidents?lat=-17.825&lng=31.034`).then((response) =>
    response.json(),
  );
  assert(!nearbyAfter.incidents.some((item) => item.id === id));
  assert.equal((await readResidentReport({ reportId: id }, ownerUid)).photos.length, 3);
  const legacyPaths = [];
  for (const [index, path] of report.rawMediaPaths.entries()) {
    const [data] = await bucket.file(path).download();
    const legacyPath = `private/reports/${ownerUid}/${id}/resolution/legacy-fixture/${index}.jpg`;
    await bucket
      .file(legacyPath)
      .save(data, { resumable: false, metadata: { contentType: 'image/jpeg' } });
    legacyPaths.push(legacyPath);
  }
  // Pending v1 media work is retained for previously committed records only.
  await db
    .collection('reports')
    .doc(id)
    .update({
      resolution: { ...resolution, evidenceStatus: 'pending', photoCount: 0 },
      resolutionEvidence: { rawMediaPaths: legacyPaths },
    });
  await db
    .collection('incidents')
    .doc(id)
    .update({ resolution: { ...resolution, evidenceStatus: 'pending', photoCount: 0 } });
  await reviewResolutionEvidence(id, async () => ({ ...decision, safePhotos: [0] }));
  assert.equal((await fetch(`${base}/incidents/${id}/resolution-photos/0`)).status, 200);
  console.log(
    'PASS: legacy resolved archives, original photos, active-map exclusion and queued legacy privacy work',
  );

  const testOnly = await fixture(true);
  await reviewSubmittedReport(testOnly, async () => {
    throw new Error('Test identity must never reach AI publication');
  });
  assert.equal((await db.collection('reports').doc(testOnly).get()).data().reviewStatus, 'held');
  assert.equal((await fetch(`${base}/incidents/${testOnly}`)).status, 404);
  const unavailable = await fixture();
  for (let attempt = 1; attempt <= 5; attempt++) {
    const review = () =>
      reviewSubmittedReport(unavailable, async () => {
        throw new Error('Simulated provider failure');
      });
    if (attempt < 5) await assert.rejects(review(), /needs a retry/);
    else await review();
  }
  const failed = (await db.collection('reports').doc(unavailable).get()).data();
  assert.equal(failed.reviewStatus, 'held');
  assert.equal(failed.reviewAttempts, 5);
  assert.equal(failed.reviewReason, 'unavailable');
  assert.equal((await fetch(`${base}/incidents/${unavailable}`)).status, 404);
  console.log('PASS: privacy holds, test isolation and five-attempt provider failure limit');
  console.log('Publication integration checks passed against demo emulators only.');
} finally {
  server.close();
  await db.terminate();
}
