import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { initializeApp } from 'firebase-admin/app';
import { initializeApp as initializeClient } from 'firebase/app';
import { connectAuthEmulator, getAuth as getClientAuth, signInAnonymously } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
const sharp = createRequire(new URL('../functions/package.json', import.meta.url))('sharp');
// Loopback demo emulators only. Never point this script at a real project.
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = 'demo-civic263';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
initializeApp({ projectId: 'demo-civic263', storageBucket: 'demo-civic263.appspot.com' });
const { withdrawReport, correctReport, deleteResidentAccount, assertAccountActive } =
  await import('../functions/src/account-lifecycle.ts');
const { reviewSubmittedReport } = await import('../functions/src/automatic-review.ts');
const { submitFieldCheck } = await import('../functions/src/field-checks.ts');
const { communityCommand } = await import('../functions/src/community.ts');
const { listResidentReports, readResidentReport } =
  await import('../functions/src/report-access.ts');
const { servePublicApi } = await import('../functions/src/public-api.ts');
const { ERASED_RESIDENT, WITHDRAWN_SUMMARY } =
  await import('../packages/domain/src/account-lifecycle.ts');
const express = createRequire(import.meta.resolve('firebase-functions/v2/https'))('express');
const app = express();
app.use(servePublicApi);
const server = await new Promise((resolve) => {
  const value = app.listen(0, '127.0.0.1', () => resolve(value));
});
const base = `http://127.0.0.1:${server.address().port}`;
const db = getFirestore();
const bucket = getStorage().bucket();
// Paid automatic review is off unless switched on; these fixtures use a stub provider.
await db.collection('operations').doc('automaticReview').set({ enabled: true });
const digest = (value) => createHash('sha256').update(value).digest('hex');
const owner = `owner-${randomUUID()}`;
const proposer = `proposer-${randomUUID()}`;
const reviewer = `reviewer-${randomUUID()}`;
const prefs = { reviewer: true, nearbyAlerts: false, backgroundAlerts: false, pushUpdates: false };
const anchor = { latitude: -17.825234, longitude: 31.033617, source: 'map' };
const decision = {
  publish: true,
  reason: 'eligible',
  title: 'EMULATOR ONLY road issue',
  summary: 'EMULATOR ONLY synthetic issue for lifecycle acceptance, no real defect.',
  area: 'EMULATOR ONLY area',
  safePhotos: [],
};
const jpeg = (background) =>
  sharp({ create: { width: 80, height: 60, channels: 3, background } })
    .jpeg()
    .toBuffer();
const exists = async (path) => (await bucket.file(path).exists())[0];
const count = async (prefix) => (await bucket.getFiles({ prefix }))[0].length;
const get = async (path) => {
  const response = await fetch(base + path);
  const json = response.headers.get('content-type')?.includes('json');
  return { status: response.status, body: response.ok && json ? await response.json() : null };
};
async function fixture(ownerUid, { photos = 0, publish = true, hold = false } = {}) {
  const id = digest(randomUUID()).slice(0, 40);
  const now = new Date().toISOString();
  const rawMediaPaths = [];
  for (let index = 0; index < photos; index += 1) {
    const path = `private/reports/${ownerUid}/${id}/${randomUUID()}.jpg`;
    await bucket.file(path).save(await jpeg(['red', 'blue', 'green'][index]), {
      resumable: false,
      metadata: { contentType: 'image/jpeg' },
    });
    rawMediaPaths.push(path);
  }
  await db
    .collection('reports')
    .doc(id)
    .set({
      ownerUid,
      categoryId: 'roads',
      description: 'EMULATOR ONLY private description with personal detail',
      landmark: 'EMULATOR ONLY private landmark',
      location: anchor,
      rawMediaPaths,
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
        photoCount: photos,
        receivedAt: now,
      },
    });
  if (publish)
    await reviewSubmittedReport(id, async () => ({
      ...decision,
      safePhotos: rawMediaPaths.map((_, index) => index),
    }));
  else if (hold)
    await reviewSubmittedReport(id, async () => ({
      ...decision,
      publish: false,
      reason: 'privacy',
    }));
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
  const image = await jpeg(action === 'report-fix' ? 'yellow' : 'green');
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
const withdraw = (reportId, uid = owner) =>
  withdrawReport({ action: 'withdraw-report', reportId }, uid);
const report = async (id) => (await db.collection('reports').doc(id).get()).data();
let handler;

try {
  for (const uid of [proposer, reviewer])
    await communityCommand({ action: 'community-preferences', preferences: prefs }, uid);

  // 1. Unpublished withdrawal erases private content and blocks any later publication.
  const held = await fixture(owner, { photos: 1, publish: false, hold: true });
  const heldPhoto = (await report(held)).rawMediaPaths[0];
  await assert.rejects(withdraw(held, proposer), { code: 'not-found' });
  const first = await withdraw(held);
  assert.equal(first.outcome, 'private');
  assert.deepEqual(await withdraw(held), first);
  let stored = await report(held);
  assert.equal(stored.moderationStatus, 'withdrawn');
  assert.equal(stored.description, '');
  assert.equal(stored.landmark, '');
  assert.equal(stored.location, undefined);
  assert.deepEqual(stored.rawMediaPaths, []);
  assert.equal(await exists(heldPhoto), false);
  assert.equal(stored.mediaCleanup, undefined);
  // An interrupted cleanup is finished by the next call, using only exact object names.
  const leftover = `private/reports/${owner}/${held}/${randomUUID()}.jpg`;
  await bucket.file(leftover).save(await jpeg('red'), { resumable: false });
  await db
    .collection('reports')
    .doc(held)
    .update({ mediaCleanup: [leftover] });
  assert.deepEqual(await withdraw(held), first);
  assert.equal(await exists(leftover), false);
  assert.equal((await report(held)).mediaCleanup, undefined);
  await reviewSubmittedReport(held, async () => decision);
  assert.equal((await report(held)).publicationStatus, 'hidden');
  const owned = (await listResidentReports({}, owner)).reports.find((item) => item.id === held);
  assert.deepEqual(owned.withdrawal, { outcome: first.outcome, withdrawnAt: first.withdrawnAt });
  assert.equal((await readResidentReport({ reportId: held }, owner)).location, null);
  console.log('PASS: unpublished withdrawal erases text, pin and photos and is idempotent');

  // 2. A review that races a withdrawal cannot publish and removes its derivatives.
  const racing = await fixture(owner, { photos: 1, publish: false });
  await assert.rejects(
    reviewSubmittedReport(racing, async () => {
      await withdraw(racing);
      return { ...decision, safePhotos: [0] };
    }),
    /retry/,
  );
  await reviewSubmittedReport(racing, async () => decision);
  assert.equal((await db.collection('publicIncidents').doc(racing).get()).exists, false);
  assert.equal(await count(`public/incidents/${racing}/`), 0);
  console.log('PASS: a running review cannot publish a withdrawn report or leave photos behind');

  // 3. Published with no other evidence: the issue and all public photos leave the register.
  const solo = await fixture(owner, { photos: 1 });
  assert.equal((await get(`/incidents/${solo}/photos/0`)).status, 200);
  assert.equal((await withdraw(solo)).outcome, 'unpublished');
  assert.equal((await get(`/incidents/${solo}`)).status, 404);
  assert.equal((await get(`/incidents/${solo}/photos/0`)).status, 404);
  assert.equal(await count(`public/incidents/${solo}/`), 0);
  assert.equal(await count(`private/reports/${owner}/${solo}/`), 0);
  const tombstone = (await db.collection('incidents').doc(solo).get()).data();
  assert.equal(tombstone.publicationStatus, 'hidden');
  assert.equal(tombstone.title, undefined);
  assert.equal(tombstone.summary, undefined);
  const list = (await get('/incidents')).body.incidents;
  assert.equal(
    list.some((item) => item.id === solo),
    false,
  );
  await assert.rejects(submitFieldCheck(await proof(solo), proposer), { code: 'not-found' });
  console.log('PASS: withdrawing an unsupported published issue removes it and its photos');

  // 4. Published with another resident's fix check: the issue stays without the reporter's material.
  const shared = await fixture(owner, { photos: 1 });
  const fix = await submitFieldCheck(await proof(shared), proposer);
  assert.equal((await withdraw(shared)).outcome, 'retained');
  const retained = (await get(`/incidents/${shared}`)).body;
  assert.equal(retained.summary, WITHDRAWN_SUMMARY);
  assert.equal(retained.photoCount, 0);
  assert.equal(retained.workflowStatus, 'resolution-pending');
  assert.equal((await get(`/incidents/${shared}/photos/0`)).status, 404);
  assert.equal(await exists(`public/incidents/${shared}/0.jpg`), false);
  assert.equal(await count(`private/reports/${owner}/${shared}/`), 0);
  assert.ok(await count(`private/reports/${proposer}/${shared}/field-checks/`));
  const checks = (await get(`/incidents/${shared}/checks`)).body.items;
  assert.deepEqual(
    checks.map((item) => item.id),
    [fix.checkId],
  );
  stored = await report(shared);
  assert.deepEqual(stored.location, anchor);
  assert.equal(stored.description, '');
  const confirm = await submitFieldCheck(await proof(shared, 'confirm-fix', fix.checkId), reviewer);
  assert.equal(confirm.workflowStatus, 'resolved');
  const notified = (id, uid) =>
    db.collection('residentNotifications').doc(uid).collection('items').doc(id).get();
  assert.equal((await notified(confirm.checkId, owner)).exists, false);
  assert.equal((await notified(confirm.checkId, proposer)).exists, true);
  console.log(
    'PASS: a withdrawn issue with community evidence stays public without the reporter’s text, photos or notifications',
  );

  // 5. Corrections replace held content, re-enter review and refuse stale or published edits.
  const editable = await fixture(owner, { photos: 2, publish: false, hold: true });
  const [keptPhoto, droppedPhoto] = (await report(editable)).rawMediaPaths;
  const corrected = {
    action: 'correct-report',
    reportId: editable,
    revision: 0,
    categoryId: 'water',
    description: 'EMULATOR ONLY corrected description without personal detail',
    landmark: 'EMULATOR ONLY corrected landmark',
    location: { ...anchor, latitude: anchor.latitude + 0.0005 },
    keepPhotos: [0],
  };
  await assert.rejects(correctReport(corrected, proposer), { code: 'not-found' });
  const receipt = await correctReport(corrected, owner);
  assert.deepEqual(receipt, { reportId: editable, revision: 1 });
  assert.deepEqual(await correctReport(corrected, owner), receipt);
  await assert.rejects(correctReport({ ...corrected, landmark: 'EMULATOR ONLY other' }, owner), {
    code: 'failed-precondition',
  });
  stored = await report(editable);
  assert.equal(stored.reviewStatus, 'queued');
  assert.equal(stored.reviewReason, null);
  assert.equal(stored.categoryId, 'water');
  assert.deepEqual(stored.rawMediaPaths, [keptPhoto]);
  assert.equal(await exists(droppedPhoto), false);
  assert.equal(await exists(keptPhoto), true);
  assert.ok((await db.collection('reportEvents').doc(`${editable}_corrected_1`).get()).exists);
  await db
    .collection('reports')
    .doc(editable)
    .update({ reviewStatus: 'processing', reviewLeaseUntil: Date.now() + 60000 });
  await assert.rejects(correctReport({ ...corrected, revision: 1 }, owner), { code: 'aborted' });
  await db
    .collection('reports')
    .doc(editable)
    .update({ reviewStatus: 'queued', reviewLeaseUntil: 0 });
  let reviewed;
  await reviewSubmittedReport(editable, async (item) => {
    reviewed = item;
    return decision;
  });
  assert.equal(reviewed.description, corrected.description);
  assert.equal((await report(editable)).publicationStatus, 'published');
  await assert.rejects(correctReport({ ...corrected, revision: 1 }, owner), {
    code: 'failed-precondition',
  });
  const capped = await fixture(owner, { publish: false, hold: true });
  await db.collection('reports').doc(capped).update({ correctionCount: 3 });
  await assert.rejects(correctReport({ ...corrected, reportId: capped }, owner), {
    code: 'failed-precondition',
  });
  console.log('PASS: corrections overwrite held content, remove photos and re-enter review once');

  // 6. Account deletion keeps anonymous public records and erases everything identity-linked.
  const erased = `erased-${randomUUID()}`;
  const otherOwner = `other-${randomUUID()}`;
  await getAuth().createUser({ uid: erased });
  await communityCommand({ action: 'community-preferences', preferences: prefs }, erased);
  const installationId = randomUUID();
  const token = `token-${randomUUID().replaceAll('-', '')}`;
  await communityCommand(
    { action: 'community-register-push', installationId, platform: 'android', token },
    erased,
  );
  const ownPublic = await fixture(erased, { photos: 1 });
  const ownHeld = await fixture(erased, { photos: 1, publish: false, hold: true });
  const elsewhere = await fixture(otherOwner);
  const proposal = await submitFieldCheck(await proof(elsewhere), erased);
  const incoming = await submitFieldCheck(await proof(ownPublic), proposer);
  const today = new Date().toISOString().slice(0, 10);
  await Promise.all([
    db.collection('reportSubmissions').doc(digest(randomUUID()).slice(0, 40)).set({
      ownerUid: erased,
    }),
    db.collection('reportRateLimits').doc(`${erased}_${today}`).set({ count: 2 }),
    db.collection('placeLookupQuotas').doc(erased).set({ count: 1 }),
    db.collection('communityFieldTests').doc(erased).set({ session: null }),
    db
      .collection('communityPositionUsage')
      .doc(digest(`${erased}|${today}`))
      .set({ count: 1 }),
  ]);
  assert.ok((await notified(incoming.checkId, erased)).exists);
  const command = { action: 'delete-account', confirm: 'DELETE' };
  await assert.rejects(deleteResidentAccount({ action: 'delete-account' }, erased), {
    code: 'invalid-argument',
  });
  assert.deepEqual(await deleteResidentAccount(command, erased, -1), { status: 'partial' });
  await assert.rejects(assertAccountActive(erased), { code: 'permission-denied' });
  let status = 'partial';
  for (let attempt = 0; attempt < 5 && status !== 'complete'; attempt += 1)
    status = (await deleteResidentAccount(command, erased)).status;
  assert.equal(status, 'complete');
  assert.deepEqual(await deleteResidentAccount(command, erased), { status: 'complete' });
  await assert.rejects(getAuth().getUser(erased), { code: 'auth/user-not-found' });
  stored = await report(ownPublic);
  assert.equal(stored.ownerUid, undefined);
  assert.equal(stored.description, '');
  assert.deepEqual(stored.rawMediaPaths, []);
  assert.deepEqual(stored.location, anchor);
  assert.equal((await get(`/incidents/${ownPublic}`)).body.summary, decision.summary);
  assert.equal((await get(`/incidents/${ownPublic}/photos/0`)).status, 200);
  assert.equal(await report(ownHeld), undefined);
  assert.equal(await count(`private/reports/${erased}/`), 0);
  const check = (await db.collection('fieldChecks').doc(proposal.checkId).get()).data();
  assert.equal(check.actorUid, ERASED_RESIDENT);
  assert.equal(check.location, undefined);
  assert.equal(check.captures, undefined);
  assert.equal(check.evidenceStatus, 'private');
  assert.equal(
    (await db.collection('publicFieldChecks').doc(proposal.checkId).get()).data().evidenceStatus,
    'private',
  );
  assert.equal((await report(elsewhere)).activeFixProposerUid, ERASED_RESIDENT);
  assert.equal(
    (await db.collection('incidents').doc(elsewhere).get()).data().activeFixProposerUid,
    ERASED_RESIDENT,
  );
  for (const [collection, field, operator] of [
    ['reports', 'ownerUid', '=='],
    ['fieldChecks', 'actorUid', '=='],
    ['reportEvents', 'actorUid', '=='],
    ['reportEvents', 'notificationUids', 'array-contains'],
    ['reportSubmissions', 'ownerUid', '=='],
    ['communityPushRegistrations', 'uid', '=='],
  ])
    assert.equal(
      (await db.collection(collection).where(field, operator, erased).get()).size,
      0,
      `${collection}.${field} still references the erased identity`,
    );
  for (const ref of [
    db.collection('residentCommunity').doc(erased),
    db.collection('residentDevices').doc(erased).collection('devices').doc(installationId),
    db.collection('communityPushRegistrations').doc(digest(token)),
    db.collection('residentNotifications').doc(erased).collection('items').doc(incoming.checkId),
    db.collection('reportRateLimits').doc(`${erased}_${today}`),
    db.collection('placeLookupQuotas').doc(erased),
    db.collection('communityFieldTests').doc(erased),
    db.collection('communityPositionUsage').doc(digest(`${erased}|${today}`)),
  ])
    assert.equal((await ref.get()).exists, false, `${ref.path} was not erased`);
  const marker = (await db.collection('accountDeletions').doc(digest(erased)).get()).data();
  assert.equal(marker.status, 'complete');
  assert.equal(JSON.stringify(marker).includes(erased), false);
  const confirmed = await submitFieldCheck(
    await proof(elsewhere, 'confirm-fix', proposal.checkId),
    reviewer,
  );
  assert.equal(confirmed.workflowStatus, 'resolved');
  assert.equal((await notified(confirmed.checkId, otherOwner)).exists, true);
  assert.equal(
    (await db.collection('residentNotifications').doc(ERASED_RESIDENT).collection('items').get())
      .size,
    0,
  );
  console.log(
    'PASS: account deletion resumes, keeps anonymous public records, erases private data and blocks stale tokens',
  );

  // 7. Through the built callable: a deleted resident's still-valid ID token adds nothing.
  handler = spawn(process.execPath, ['scripts/intake-test-server.mjs'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  await new Promise((resolve, reject) => {
    handler.stdout.on('data', (chunk) => String(chunk).includes('listening') && resolve());
    handler.on('exit', (code) => reject(new Error(`Demo handler exited with ${code}`)));
  });
  const client = initializeClient(
    { projectId: 'demo-civic263', apiKey: 'demo-only', appId: '1:123:web:demo' },
    randomUUID(),
  );
  const clientAuth = getClientAuth(client);
  connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(client, 'europe-west1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const { user } = await signInAnonymously(clientAuth);
  const submit = httpsCallable(functions, 'submitReport');
  await submit({ action: 'community-preferences', preferences: prefs });
  let deletion = { status: 'partial' };
  for (let attempt = 0; attempt < 5 && deletion.status !== 'complete'; attempt += 1)
    deletion = (await submit({ action: 'delete-account', confirm: 'DELETE' })).data;
  assert.equal(deletion.status, 'complete');
  await assert.rejects(getAuth().getUser(user.uid), { code: 'auth/user-not-found' });
  // The Auth emulator always re-checks the user (401); production relies on the deletion marker.
  await assert.rejects(submit({ action: 'community-preferences', preferences: prefs }), (error) =>
    ['functions/unauthenticated', 'functions/permission-denied'].includes(error.code),
  );
  assert.equal((await db.collection('residentCommunity').doc(user.uid).get()).exists, false);
  // A still-existing user with a deletion in progress reaches the marker guard itself.
  const second = initializeClient(
    { projectId: 'demo-civic263', apiKey: 'demo-only', appId: '1:123:web:demo' },
    randomUUID(),
  );
  const secondAuth = getClientAuth(second);
  connectAuthEmulator(secondAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const secondFunctions = getFunctions(second, 'europe-west1');
  connectFunctionsEmulator(secondFunctions, '127.0.0.1', 5001);
  const pending = (await signInAnonymously(secondAuth)).user;
  const secondSubmit = httpsCallable(secondFunctions, 'submitReport');
  await db.collection('accountDeletions').doc(digest(pending.uid)).set({ status: 'erasing' });
  for (const action of [
    { action: 'community-preferences', preferences: prefs },
    { action: 'withdraw-report', reportId: held },
  ])
    await assert.rejects(
      secondSubmit(action),
      (error) => error.code === 'functions/permission-denied',
    );
  assert.equal(
    (await secondSubmit({ action: 'delete-account', confirm: 'DELETE' })).data.status,
    'complete',
  );
  console.log(
    'PASS: the built callable finishes deletion and refuses new commands while it is in progress',
  );
} finally {
  server.close();
  handler?.kill();
}
