import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
const sharp = createRequire(new URL('../functions/package.json', import.meta.url))('sharp');
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = 'demo-civic263';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
initializeApp({ projectId: 'demo-civic263', storageBucket: 'demo-civic263.appspot.com' });
const { submitFieldCheck } = await import('../functions/src/field-checks.ts');
const { communityCommand } = await import('../functions/src/community.ts');
const { fieldTestCommand } = await import('../functions/src/field-test.ts');
const { reviewFieldEvidence } = await import('../functions/src/field-evidence-review.ts');
const { deliverCommunityNotifications } =
  await import('../functions/src/community-notifications.ts');
const { reviewSubmittedReport } = await import('../functions/src/automatic-review.ts');
const { readResidentReport } = await import('../functions/src/report-access.ts');
const { servePublicApi } = await import('../functions/src/public-api.ts');
const express = createRequire(import.meta.resolve('firebase-functions/v2/https'))('express');
const app = express();
app.use(servePublicApi);
const server = await new Promise((resolve) => {
  const value = app.listen(0, '127.0.0.1', () => resolve(value));
});
const base = `http://127.0.0.1:${server.address().port}`;
const db = getFirestore();
const bucket = getStorage().bucket();
const owner = `owner-${randomUUID()}`;
const proposer = `proposer-${randomUUID()}`;
const reviewer = `reviewer-${randomUUID()}`;
const prefs = { reviewer: true, nearbyAlerts: false, backgroundAlerts: false, pushUpdates: false };
const anchor = { latitude: -17.825234, longitude: 31.033617, source: 'map' };
const decision = {
  publish: true,
  reason: 'eligible',
  title: 'EMULATOR ONLY road issue',
  summary: 'EMULATOR ONLY synthetic issue for community acceptance, no real defect.',
  area: 'EMULATOR ONLY area',
  safePhotos: [],
};
async function fixture(published = true) {
  const id = createHash('sha256').update(randomUUID()).digest('hex').slice(0, 40);
  const now = new Date().toISOString();
  await db
    .collection('reports')
    .doc(id)
    .set({
      ownerUid: owner,
      categoryId: 'roads',
      description: decision.summary,
      landmark: decision.area,
      location: anchor,
      rawMediaPaths: [],
      moderationStatus: 'pending',
      publicationStatus: 'hidden',
      workflowStatus: 'received',
      handoffStatus: 'not-sent',
      reviewStatus: 'queued',
      createdAt: now,
      receipt: {
        testOnly: false,
        reportId: id,
        reference: `C263-${id.slice(0, 12).toUpperCase()}`,
        photoCount: 0,
        receivedAt: now,
      },
    });
  if (published) await reviewSubmittedReport(id, async () => decision);
  return id;
}
async function proof(reportId, action = 'report-fix', fixId) {
  const location = {
    latitude: anchor.latitude,
    longitude: anchor.longitude,
    accuracyMeters: 5,
    timestamp: Date.now(),
    mocked: false,
  };
  const image = await sharp({
    create: {
      width: 80,
      height: 60,
      channels: 3,
      background: action === 'report-fix' ? 'yellow' : 'green',
    },
  })
    .withMetadata({ exif: { IFD0: { Artist: 'PRIVATE VISIT DATA' } } })
    .jpeg()
    .toBuffer();
  return {
    action,
    reportId,
    attemptId: randomUUID(),
    location,
    photos: [
      {
        id: randomUUID(),
        width: 80,
        height: 60,
        base64: image.toString('base64'),
        captureSource: 'camera',
        capturedAt: location.timestamp,
        location,
      },
    ],
    ...(fixId ? { fixId } : {}),
  };
}
const get = async (path) => {
  const response = await fetch(base + path);
  return {
    status: response.status,
    body:
      response.ok && response.headers.get('content-type')?.includes('json')
        ? await response.json()
        : null,
    response,
  };
};
try {
  const qa = `qa-${randomUUID()}`;
  const privateTest = { action: 'community-field-test', operation: 'state' };
  await assert.rejects(fieldTestCommand(privateTest, qa, false), { code: 'permission-denied' });
  await assert.rejects(fieldTestCommand({ ...privateTest, operation: 'unknown' }, qa, true), {
    code: 'invalid-argument',
  });
  const start = {
    ...privateTest,
    operation: 'start',
    attemptId: randomUUID(),
    location: { ...anchor, accuracyMeters: 5, timestamp: Date.now(), mocked: false },
  };
  delete start.location.source;
  await assert.rejects(
    fieldTestCommand({ ...start, location: { ...start.location, mocked: true } }, qa, true),
  );
  const publicCount = (await db.collection('publicIncidents').count().get()).data().count;
  const test = await fieldTestCommand(start, qa, true);
  assert.deepEqual(await fieldTestCommand(start, qa, true), test);
  assert.equal((await fieldTestCommand(privateTest, `other-${qa}`, true)).session, null);
  const event = { ...privateTest, operation: 'event', testId: test.session.id, source: 'geofence' };
  assert.equal(
    (await fieldTestCommand({ ...event, kind: 'entered' }, qa, true)).session.status,
    'waiting-to-leave',
  );
  for (const [kind, status] of [
    ['left', 'outside'],
    ['entered', 'returned'],
    ['notified', 'notified'],
  ])
    assert.equal((await fieldTestCommand({ ...event, kind }, qa, true)).session.status, status);
  assert.equal((await db.collection('publicIncidents').count().get()).data().count, publicCount);
  await fieldTestCommand({ ...privateTest, operation: 'stop' }, qa, true);
  assert.equal((await fieldTestCommand(privateTest, qa, true)).session, null);
  const again = await fieldTestCommand({ ...start, attemptId: randomUUID() }, qa, true);
  await db
    .collection('communityFieldTests')
    .doc(qa)
    .update({ session: { ...again.session, expiresAt: new Date(0).toISOString() } });
  assert.equal((await fieldTestCommand(privateTest, qa, true)).session, null);
  console.log(
    'PASS: private field tests enforce QA claims, ownership, fresh GPS, ordered events and expiry without creating public issues',
  );
  const id = await fixture();
  const hidden = await fixture(false);
  await assert.rejects(submitFieldCheck(await proof(hidden), proposer), { code: 'not-found' });
  await assert.rejects(submitFieldCheck(await proof(id), proposer, true), {
    code: 'permission-denied',
  });
  const initial = (await get(`/incidents/${id}`)).body;
  const command = await proof(id);
  for (const changed of [
    { photos: [] },
    { photos: Array(4).fill(command.photos[0]) },
    { location: { ...command.location, mocked: true } },
    { location: { ...command.location, accuracyMeters: 30 } },
    { location: { ...command.location, timestamp: Date.now() - 180000 } },
    { photos: [{ ...command.photos[0], captureSource: 'gallery' }] },
  ])
    await assert.rejects(submitFieldCheck({ ...command, ...changed }, proposer));
  await assert.rejects(
    submitFieldCheck(
      { ...command, location: { ...command.location, latitude: anchor.latitude + 0.001 } },
      proposer,
    ),
    (error) => error.code === 'failed-precondition' && !/\d+ metres from/.test(error.message),
  );
  await assert.rejects(
    communityCommand(
      {
        action: 'community-context',
        reportId: id,
        location: { ...command.location, latitude: anchor.latitude + 0.001 },
      },
      proposer,
    ),
    (error) => !error.message.includes('You are'),
  );
  const concurrent = await Promise.allSettled([
    submitFieldCheck(command, proposer),
    submitFieldCheck(command, proposer),
  ]);
  const receipt = concurrent.find((value) => value.status === 'fulfilled').value;
  assert.deepEqual(await submitFieldCheck(command, proposer), receipt);
  await assert.rejects(
    submitFieldCheck(
      { ...command, photos: [{ ...command.photos[0], id: randomUUID() }] },
      proposer,
    ),
    { code: 'already-exists' },
  );
  assert.equal(receipt.workflowStatus, 'resolution-pending');
  const pending = (await get(`/incidents/${id}`)).body;
  assert.equal(pending.communityResolution.status, 'awaiting-confirmation');
  assert.equal(pending.lastApprovedEvidenceAt, initial.lastApprovedEvidenceAt);
  assert(
    (await get('/incidents?lat=-17.825&lng=31.034')).body.incidents.some((item) => item.id === id),
  );
  assert.equal((await communityCommand({ action: 'community-inbox' }, owner)).items.length, 1);
  assert.equal((await get(`/incidents/${id}/checks/${receipt.checkId}/photos/0`)).status, 404);
  await assert.rejects(
    communityCommand({ action: 'community-visit', checkId: receipt.checkId }, reviewer),
    { code: 'not-found' },
  );
  const privateVisit = await communityCommand(
    { action: 'community-visit', checkId: receipt.checkId },
    proposer,
  );
  assert.equal(privateVisit.photos.length, 1);
  assert.equal(
    (await sharp(Buffer.from(privateVisit.photos[0].base64, 'base64')).metadata()).exif,
    undefined,
  );
  await assert.rejects(readResidentReport({ reportId: id }, proposer), { code: 'not-found' });
  console.log(
    'PASS: any resident can propose a fix; private records, pending map, immutable retries and owner inbox stay correct',
  );

  await assert.rejects(
    submitFieldCheck(await proof(id, 'confirm-fix', receipt.checkId), reviewer),
    /Opt into/,
  );
  await communityCommand({ action: 'community-preferences', preferences: prefs }, reviewer);
  await communityCommand({ action: 'community-preferences', preferences: prefs }, proposer);
  await assert.rejects(
    submitFieldCheck(await proof(id, 'confirm-fix', receipt.checkId), proposer),
    /different resident/,
  );
  await assert.rejects(
    submitFieldCheck(await proof(id, 'confirm-fix', 'b'.repeat(40)), reviewer),
    /already changed/,
  );
  const confirmed = await submitFieldCheck(
    await proof(id, 'confirm-fix', receipt.checkId),
    reviewer,
  );
  assert.equal(confirmed.workflowStatus, 'resolved');
  const closed = (await get(`/incidents/${id}`)).body;
  assert.equal(closed.communityResolution.status, 'confirmed');
  assert(
    !(await get('/incidents?lat=-17.825&lng=31.034')).body.incidents.some((item) => item.id === id),
  );
  assert.equal((await communityCommand({ action: 'community-inbox' }, owner)).items.length, 2);
  assert.equal((await communityCommand({ action: 'community-inbox' }, proposer)).items.length, 1);
  assert.equal(
    (await readResidentReport({ reportId: id }, owner)).communityResolution.status,
    'confirmed',
  );
  assert.equal((await db.collection('reportEvents').where('reportId', '==', id).get()).size, 2);
  for (const data of [pending, closed, (await get(`/incidents/${id}/checks`)).body]) {
    const json = JSON.stringify(data);
    for (const value of [owner, proposer, reviewer, 'rawMediaPaths', 'actorUid', 'accuracyMeters'])
      assert(!json.includes(value));
  }
  console.log(
    'PASS: opt-in, independent current-fix confirmation, map removal and both resident notifications',
  );

  await reviewFieldEvidence(receipt.checkId, async () => ({ ...decision, safePhotos: [0] }));
  await reviewFieldEvidence(receipt.checkId, async () => {
    throw Error('Completed privacy review must not repeat');
  });
  const publicPhoto = await get(`/incidents/${id}/checks/${receipt.checkId}/photos/0`);
  assert.equal(publicPhoto.status, 200);
  assert.equal(
    (await sharp(Buffer.from(await publicPhoto.response.arrayBuffer())).metadata()).exif,
    undefined,
  );
  await reviewFieldEvidence(confirmed.checkId, async () => ({
    ...decision,
    publish: false,
    safePhotos: [],
  }));
  assert.equal((await get(`/incidents/${id}/checks/${confirmed.checkId}/photos/0`)).status, 404);
  assert.equal(
    (await communityCommand({ action: 'community-visit', checkId: confirmed.checkId }, reviewer))
      .photos.length,
    1,
  );
  console.log(
    'PASS: separate camera originals are private; only reviewed derivatives can load publicly',
  );

  const rejectId = await fixture();
  const first = await submitFieldCheck(await proof(rejectId), proposer);
  const rejected = await submitFieldCheck(
    await proof(rejectId, 'reject-fix', first.checkId),
    reviewer,
  );
  assert.equal(rejected.workflowStatus, 'received');
  assert.equal((await get(`/incidents/${rejectId}`)).body.communityResolution.status, 'not-fixed');
  const second = await submitFieldCheck(await proof(rejectId), proposer);
  await assert.rejects(
    submitFieldCheck(await proof(rejectId, 'confirm-fix', first.checkId), reviewer),
    /already changed/,
  );
  await communityCommand({ action: 'community-preferences', preferences: prefs }, owner);
  const reviewCommand = await proof(rejectId, 'confirm-fix', second.checkId);
  const reviewRace = await Promise.allSettled([
    submitFieldCheck(reviewCommand, reviewer),
    submitFieldCheck({ ...reviewCommand, attemptId: randomUUID(), action: 'reject-fix' }, owner),
  ]);
  assert(reviewRace.some((value) => value.status === 'fulfilled'));
  assert.equal(
    (await db.collection('reportEvents').where('reportId', '==', rejectId).get()).size,
    4,
  );
  console.log(
    'PASS: still-broken verdict restores the active issue, retains history and rejects stale proposal reviews',
  );

  const device = randomUUID();
  const token = 'TEST_TOKEN_' + randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  await communityCommand(
    { action: 'community-preferences', preferences: { ...prefs, pushUpdates: true } },
    owner,
  );
  await communityCommand(
    { action: 'community-register-push', installationId: device, platform: 'android', token },
    owner,
  );
  const appleDevice = randomUUID(),
    appleToken = 'IOS_TEST_' + randomUUID().replaceAll('-', '');
  await communityCommand(
    {
      action: 'community-register-push',
      installationId: appleDevice,
      platform: 'ios',
      token: appleToken,
    },
    owner,
  );
  assert.equal(
    (
      await db.collection('residentDevices').doc(owner).collection('devices').doc(appleDevice).get()
    ).data().platform,
    'ios',
  );
  let sent = 0;
  const mockSend = async (messages) => {
    sent += messages.length;
    assert(
      messages.every(
        (message) =>
          [token, appleToken].includes(message.token) &&
          message.apns.headers['apns-push-type'] === 'alert' &&
          message.apns.payload.aps.sound === 'default' &&
          !JSON.stringify(message).includes('accuracyMeters'),
      ),
    );
    return {
      responses: messages.map(() => ({ success: true })),
      successCount: messages.length,
      failureCount: 0,
    };
  };
  await deliverCommunityNotifications(receipt.checkId, [owner], mockSend);
  await deliverCommunityNotifications(receipt.checkId, [owner], mockSend);
  assert.equal(sent, 2);
  await communityCommand({ action: 'community-read', notificationId: receipt.checkId }, owner);
  assert(
    (await communityCommand({ action: 'community-inbox' }, owner)).items.find(
      (item) => item.id === receipt.checkId,
    ).readAt,
  );
  await assert.rejects(
    communityCommand({ action: 'community-read', notificationId: receipt.checkId }, reviewer),
    { code: 'not-found' },
  );
  // Moving a token to a new signed-in identity must unbind its previous recipient.
  await communityCommand(
    { action: 'community-register-push', installationId: device, platform: 'android', token },
    reviewer,
  );
  assert.equal(
    (await db.collection('residentDevices').doc(owner).collection('devices').doc(device).get())
      .exists,
    false,
  );
  console.log(
    'PASS: private inbox, bounded idempotent push, read ownership and token-account rebinding',
  );
  console.log('Community integration checks passed against demo emulators only.');
} finally {
  server.close();
}
