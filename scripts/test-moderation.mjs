import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp as initializeClient } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth as getClientAuth,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
const sharp = createRequire(new URL('../functions/package.json', import.meta.url))('sharp');
// Loopback demo emulators only. Never point this script at a real project.
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = 'demo-civic263';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
initializeApp({ projectId: 'demo-civic263', storageBucket: 'demo-civic263.appspot.com' });
const { requestHumanReview, reportConcern, runStaffCommand, assertMayContribute } =
  await import('../functions/src/moderation.ts');
const { correctReport, withdrawReport, deleteResidentAccount } =
  await import('../functions/src/account-lifecycle.ts');
const { reviewSubmittedReport } = await import('../functions/src/automatic-review.ts');
const { submitFieldCheck } = await import('../functions/src/field-checks.ts');
const { reviewFieldEvidence } = await import('../functions/src/field-evidence-review.ts');
const { communityCommand } = await import('../functions/src/community.ts');
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
  summary: 'EMULATOR ONLY synthetic issue for moderation acceptance, no real defect.',
  area: 'EMULATOR ONLY area',
  safePhotos: [],
};
const colours = ['red', 'blue', 'green'];
const jpeg = (background) =>
  sharp({ create: { width: 80, height: 60, channels: 3, background } })
    .jpeg()
    .toBuffer();
const exists = async (path) => (await bucket.file(path).exists())[0];
const get = async (path) => {
  const response = await fetch(base + path);
  const json = response.headers.get('content-type')?.includes('json');
  return { status: response.status, body: response.ok && json ? await response.json() : null };
};
async function fixture(
  ownerUid,
  { photos = 0, publish = true, hold = false, testOnly = false } = {},
) {
  const id = digest(randomUUID()).slice(0, 40);
  const now = new Date().toISOString();
  const rawMediaPaths = [];
  for (let index = 0; index < photos; index += 1) {
    const path = `private/reports/${ownerUid}/${id}/${randomUUID()}.jpg`;
    await bucket.file(path).save(await jpeg(colours[index]), {
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
      description: 'EMULATOR ONLY private description',
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
        testOnly,
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
      reason: 'uncertain',
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
        base64: (await jpeg('yellow')).toString('base64'),
        captureSource: 'camera',
        capturedAt: location.timestamp,
        location,
      },
    ],
    ...(fixId ? { fixId } : {}),
  };
}
const staffUid = `staff-${randomUUID()}`;
const staff = (uid = staffUid, token = {}) => ({
  uid,
  token: { email_verified: true, firebase: { sign_in_provider: 'password' }, ...token },
});
const run = (command, auth = staff()) => runStaffCommand(command, auth);
const complain = (target, uid, reason = 'offensive') =>
  reportConcern({ action: 'report-concern', target, reason }, uid);
const reporters = () => Array.from({ length: 3 }, () => `reporter-${randomUUID()}`);
let handler;

try {
  // 1. Operators: only an active moderator record with a verified password sign-in.
  await assert.rejects(run({ action: 'staff-profile' }), { code: 'permission-denied' });
  await db
    .collection('staffMembers')
    .doc(staffUid)
    .set({ email: 'operator@example.invalid', role: 'moderator', active: true });
  assert.equal((await run({ action: 'staff-profile' })).role, 'moderator');
  for (const auth of [
    staff(staffUid, { email_verified: false }),
    staff(staffUid, { firebase: { sign_in_provider: 'anonymous' } }),
  ])
    await assert.rejects(run({ action: 'staff-profile' }, auth), { code: 'permission-denied' });
  const inactive = `staff-${randomUUID()}`;
  await db.collection('staffMembers').doc(inactive).set({ role: 'moderator', active: false });
  await assert.rejects(run({ action: 'staff-profile' }, staff(inactive)), {
    code: 'permission-denied',
  });
  await assert.rejects(run({ action: 'staff-queue', queue: 'everything' }), {
    code: 'invalid-argument',
  });
  console.log(
    'PASS: operator commands need an active moderator record and a verified password sign-in',
  );

  // 2. Appeals: once per held report, freezes corrections, and a reasoned keep-private decision.
  const kept = await fixture(owner, { photos: 1, publish: false, hold: true });
  const appealCommand = {
    action: 'request-review',
    reportId: kept,
    note: 'EMULATOR ONLY appeal note',
  };
  await assert.rejects(requestHumanReview(appealCommand, proposer), { code: 'not-found' });
  const appeal = await requestHumanReview(appealCommand, owner);
  assert.equal(appeal.status, 'open');
  assert.ok(Date.parse(appeal.dueBy) > Date.parse(appeal.requestedAt));
  assert.deepEqual(await requestHumanReview(appealCommand, owner), appeal);
  await assert.rejects(
    correctReport(
      {
        action: 'correct-report',
        reportId: kept,
        revision: 0,
        categoryId: 'roads',
        description: 'EMULATOR ONLY corrected while appealed',
        landmark: 'EMULATOR ONLY place',
        location: anchor,
        keepPhotos: [0],
      },
      owner,
    ),
    { code: 'failed-precondition' },
  );
  const queue = (await run({ action: 'staff-queue', queue: 'appeals' })).items;
  const entry = queue.find((item) => item.reportId === kept);
  assert.equal(entry.note, appealCommand.note);
  assert.equal(JSON.stringify(entry).includes(owner), false);
  const detail = await run({ action: 'staff-report', reportId: kept });
  assert.equal(detail.originals.length, 1);
  assert.equal(detail.description, 'EMULATOR ONLY private description');
  assert.equal(JSON.stringify(detail).includes(owner), false);
  await run({
    action: 'staff-keep-private',
    reportId: kept,
    reason: 'not-a-service-issue',
    note: 'EMULATOR ONLY reviewer note',
  });
  const decided = await readResidentReport({ reportId: kept }, owner);
  assert.equal(decided.appeal.status, 'kept-private');
  assert.equal(decided.appeal.reason, 'not-a-service-issue');
  assert.equal(decided.appeal.note, 'EMULATOR ONLY reviewer note');
  assert.deepEqual((await requestHumanReview(appealCommand, owner)).status, 'kept-private');
  await assert.rejects(run({ action: 'staff-keep-private', reportId: kept, reason: 'other' }), {
    code: 'failed-precondition',
  });
  const testReport = await fixture(owner, { publish: false, hold: true, testOnly: true });
  await assert.rejects(
    requestHumanReview({ action: 'request-review', reportId: testReport }, owner),
    {
      code: 'failed-precondition',
    },
  );
  console.log(
    'PASS: one appeal per held report, corrections frozen meanwhile, reasoned keep-private decision',
  );

  // 3. An operator publishes a held report with chosen photos and their own neutral text.
  const appealed = await fixture(owner, { photos: 2, publish: false, hold: true });
  await requestHumanReview({ action: 'request-review', reportId: appealed }, owner);
  const publication = {
    action: 'staff-publish',
    reportId: appealed,
    title: 'EMULATOR ONLY reviewed road issue',
    summary: 'EMULATOR ONLY summary written by an operator.',
    area: 'EMULATOR ONLY area',
    photos: [1],
  };
  await assert.rejects(run({ ...publication, summary: 'Call 0772 123 456 for details please' }), {
    code: 'invalid-argument',
  });
  await run(publication);
  const published = (await get(`/incidents/${appealed}`)).body;
  assert.equal(published.reviewMethod, 'staff');
  assert.equal(published.summary, publication.summary);
  assert.equal(published.photoCount, 1);
  assert.equal((await get(`/incidents/${appealed}/photos/0`)).status, 200);
  assert.equal(
    (await readResidentReport({ reportId: appealed }, owner)).appeal.status,
    'published',
  );
  await assert.rejects(run(publication), { code: 'failed-precondition' });
  const audit = await db.collection('moderationAudit').where('reportId', '==', appealed).get();
  assert.deepEqual(
    audit.docs.map((doc) => doc.data().action),
    ['publish'],
  );
  console.log(
    'PASS: an operator can publish a held report with chosen photos and written text, audited',
  );

  // 4. Photo complaints: three reporters hide one photo without renumbering; restore and remove.
  const pictured = await fixture(owner, { photos: 2 });
  const [first, second, third] = reporters();
  const photoTarget = { type: 'photo', reportId: pictured, index: 1 };
  await complain(photoTarget, first, 'personal-information');
  await complain(photoTarget, first, 'personal-information');
  await complain(photoTarget, second);
  assert.equal((await get(`/incidents/${pictured}`)).body.photoCount, 2);
  await complain(photoTarget, third);
  assert.equal((await get(`/incidents/${pictured}`)).body.photoCount, 1);
  assert.equal((await get(`/incidents/${pictured}/photos/0`)).status, 200);
  assert.equal((await get(`/incidents/${pictured}/photos/1`)).status, 404);
  const key = `${pictured}_photo_1`;
  const complaints = (await run({ action: 'staff-queue', queue: 'complaints' })).items;
  const flag = complaints.find((item) => item.key === key);
  assert.equal(flag.status, 'auto-hidden');
  assert.equal(flag.reporters, 3);
  assert.equal(flag.priority, 'high');
  const notes = (await run({ action: 'staff-report', reportId: pictured })).complaints;
  assert.equal(notes.length, 3);
  assert.equal(JSON.stringify(notes).includes(first), false);
  await run({ action: 'staff-resolve-complaint', key, outcome: 'restore' });
  assert.equal((await get(`/incidents/${pictured}`)).body.photoCount, 2);
  await complain(photoTarget, third);
  assert.equal((await get(`/incidents/${pictured}`)).body.photoCount, 2);
  for (const uid of reporters()) await complain(photoTarget, uid);
  assert.equal((await get(`/incidents/${pictured}`)).body.photoCount, 1);
  await run({ action: 'staff-resolve-complaint', key, outcome: 'remove' });
  assert.equal(await exists(`public/incidents/${pictured}/1.jpg`), false);
  assert.equal(await exists(`public/incidents/${pictured}/0.jpg`), true);
  await assert.rejects(complain(photoTarget, `late-${randomUUID()}`), { code: 'not-found' });
  console.log(
    'PASS: three distinct reporters hide a photo; restore needs three new reporters; removal deletes it',
  );

  // 5. Issue and community-check complaints, and the effect on community reviewing.
  const shared = await fixture(owner, { photos: 1 });
  for (const uid of [proposer, reviewer])
    await communityCommand({ action: 'community-preferences', preferences: prefs }, uid);
  const fix = await submitFieldCheck(await proof(shared), proposer);
  await reviewFieldEvidence(fix.checkId, async () => ({ ...decision, safePhotos: [0] }));
  assert.equal((await get(`/incidents/${shared}/checks/${fix.checkId}/photos/0`)).status, 200);
  const checkTarget = { type: 'check', reportId: shared, checkId: fix.checkId };
  for (const uid of reporters()) await complain(checkTarget, uid, 'unsafe');
  assert.equal((await get(`/incidents/${shared}/checks/${fix.checkId}/photos/0`)).status, 404);
  for (const uid of reporters()) await complain({ type: 'issue', reportId: shared }, uid);
  assert.equal((await get(`/incidents/${shared}`)).status, 404);
  assert.equal(
    (await readResidentReport({ reportId: shared }, owner)).moderationHold.status,
    'hidden',
  );
  await assert.rejects(
    submitFieldCheck(await proof(shared, 'confirm-fix', fix.checkId), reviewer),
    { code: 'not-found' },
  );
  await run({ action: 'staff-resolve-complaint', key: shared, outcome: 'restore' });
  assert.equal((await get(`/incidents/${shared}`)).status, 200);
  assert.equal((await get(`/incidents/${shared}/checks/${fix.checkId}/photos/0`)).status, 404);
  await run({
    action: 'staff-resolve-complaint',
    key: `${shared}_check_${fix.checkId}`,
    outcome: 'remove',
  });
  const checkBatch = (await db.collection('fieldChecks').doc(fix.checkId).get()).data();
  assert.equal(checkBatch.evidenceStatus, 'private');
  assert.equal(
    (await submitFieldCheck(await proof(shared, 'confirm-fix', fix.checkId), reviewer))
      .workflowStatus,
    'resolved',
  );
  await assert.rejects(complain({ type: 'issue', reportId: kept }, first), { code: 'not-found' });
  await assert.rejects(
    reportConcern(
      { action: 'report-concern', target: { type: 'issue', reportId: shared }, reason: 'boring' },
      first,
    ),
    { code: 'invalid-argument' },
  );
  console.log(
    'PASS: issue and check complaints hide content, pause community reviewing and can be restored or removed',
  );

  // 6. Withdrawal closes the appeal and complaints; blocking stops new contributions only.
  const withdrawing = await fixture(owner, { photos: 1, publish: false, hold: true });
  await requestHumanReview({ action: 'request-review', reportId: withdrawing }, owner);
  await withdrawReport({ action: 'withdraw-report', reportId: withdrawing }, owner);
  assert.equal((await db.collection('appeals').doc(withdrawing).get()).exists, false);
  const blocked = await fixture(`blocked-${randomUUID()}`, { photos: 0 });
  const blockedOwner = (await db.collection('reports').doc(blocked).get()).data().ownerUid;
  const { blockId } = await run({
    action: 'staff-block',
    reportId: blocked,
    note: 'EMULATOR ONLY spam',
  });
  await assert.rejects(assertMayContribute(blockedOwner), { code: 'permission-denied' });
  await assertMayContribute(owner);
  const blocks = (await run({ action: 'staff-queue', queue: 'blocks' })).items;
  assert.ok(blocks.some((item) => item.blockId === blockId));
  assert.equal(JSON.stringify(blocks).includes(blockedOwner), false);
  assert.equal(
    (await withdrawReport({ action: 'withdraw-report', reportId: blocked }, blockedOwner)).outcome,
    'unpublished',
  );
  await run({ action: 'staff-unblock', blockId, note: 'EMULATOR ONLY appeal upheld' });
  await assertMayContribute(blockedOwner);
  console.log(
    'PASS: withdrawal closes appeals; blocks stop new contributions but never rights or withdrawals',
  );

  // 7. Account deletion erases the resident's complaints and any block record.
  const complainer = `complainer-${randomUUID()}`;
  const target = await fixture(owner, { photos: 0 });
  await complain({ type: 'issue', reportId: target }, complainer);
  await db.collection('residentBlocks').doc(digest(complainer)).set({ note: 'EMULATOR ONLY' });
  let status = 'partial';
  for (let attempt = 0; attempt < 5 && status !== 'complete'; attempt += 1)
    status = (
      await deleteResidentAccount({ action: 'delete-account', confirm: 'DELETE' }, complainer)
    ).status;
  assert.equal(status, 'complete');
  assert.equal(
    (await db.collection('contentReports').where('reporterHash', '==', digest(complainer)).get())
      .size,
    0,
  );
  assert.equal((await db.collection('residentBlocks').doc(digest(complainer)).get()).exists, false);
  assert.equal((await db.collection('contentFlags').doc(target).get()).data().reporters, 1);
  console.log(
    'PASS: account deletion erases the resident’s complaints and block record, keeping aggregate counts',
  );

  // 8. Through the built callable: a verified operator signs in with a password.
  handler = spawn(process.execPath, ['scripts/intake-test-server.mjs'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  await new Promise((resolve, reject) => {
    handler.stdout.on('data', (chunk) => String(chunk).includes('listening') && resolve());
    handler.on('exit', (code) => reject(new Error(`Demo handler exited with ${code}`)));
  });
  const email = `operator-${randomUUID()}@example.invalid`;
  const password = `Demo-only-${randomUUID()}`;
  const operator = await getAuth().createUser({ email, password, emailVerified: true });
  const client = initializeClient(
    { projectId: 'demo-civic263', apiKey: 'demo-only', appId: '1:123:web:demo' },
    randomUUID(),
  );
  const clientAuth = getClientAuth(client);
  connectAuthEmulator(clientAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(client, 'europe-west1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  await signInWithEmailAndPassword(clientAuth, email, password);
  const call = httpsCallable(functions, 'staffCommand');
  await assert.rejects(
    call({ action: 'staff-profile' }),
    (error) => error.code === 'functions/permission-denied',
  );
  await db
    .collection('staffMembers')
    .doc(operator.uid)
    .set({ email, role: 'moderator', active: true });
  assert.equal((await call({ action: 'staff-profile' })).data.role, 'moderator');
  assert.ok(Array.isArray((await call({ action: 'staff-queue', queue: 'held' })).data.items));
  console.log('PASS: the built staffCommand callable admits only a listed operator');
} finally {
  server.close();
  handler?.kill();
}
