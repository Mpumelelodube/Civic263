import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, ref, getBytes, uploadBytes } from 'firebase/storage';
import { initializeApp as adminApp } from 'firebase-admin/app';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { getStorage as adminStorage } from 'firebase-admin/storage';
const sharp = createRequire(new URL('../functions/package.json', import.meta.url))('sharp');

// Hard-coded demo project and localhost prevent this script from touching production.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const projectId = 'demo-civic263';
const storageBucket = `${projectId}.appspot.com`;
let httpServer;
if (process.argv.includes('--http-handler')) {
  const { startIntakeTestServer } = await import('./intake-test-server.mjs');
  httpServer = await startIntakeTestServer();
}
const admin = adminApp({ projectId, storageBucket }, 'intake-test-admin');
const apps = [];
function resident() {
  const app = initializeApp(
    { projectId, apiKey: 'demo-only-key', appId: 'demo-app', storageBucket },
    randomUUID(),
  );
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(app, 'europe-west1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  return { auth, db, storage, send: httpsCallable(functions, 'submitReport') };
}
const input = {
  submissionId: randomUUID(),
  categoryId: 'roads',
  description: 'TEST ONLY: Fictional emulator issue.',
  landmark: 'TEST ONLY: no real place',
  location: { latitude: -17.8, longitude: 31, source: 'map' },
  photos: [],
};
for (const background of ['red', 'green', 'blue']) {
  const jpeg = await sharp({ create: { width: 80, height: 60, channels: 3, background } })
    .withMetadata({ exif: { IFD0: { Artist: 'PRIVATE TEST METADATA' } } })
    .jpeg()
    .toBuffer();
  input.photos.push({ id: randomUUID(), width: 80, height: 60, base64: jpeg.toString('base64') });
}
try {
  const owner = resident();
  await assert.rejects(owner.send(input), { code: 'functions/unauthenticated' });
  await signInAnonymously(owner.auth);
  await assert.rejects(
    owner.send({ ...input, photos: [...input.photos, { ...input.photos[0], id: randomUUID() }] }),
    {
      code: 'functions/invalid-argument',
    },
  );
  const concurrent = await Promise.allSettled([owner.send(input), owner.send(input)]);
  assert(
    concurrent.some((result) => result.status === 'fulfilled'),
    JSON.stringify(
      concurrent.map((result) =>
        result.status === 'rejected'
          ? { code: result.reason.code, message: result.reason.message }
          : { received: true },
      ),
    ),
  );
  const receipt = (await owner.send(input)).data;
  assert.equal(receipt.photoCount, 3);
  assert.equal(receipt.testOnly, true);
  assert.equal((await owner.send(input)).data.reportId, receipt.reportId);
  await assert.rejects(
    owner.send({ ...input, description: 'A changed retry payload should be refused.' }),
    { code: 'functions/already-exists' },
  );
  const report = await getDoc(doc(owner.db, 'reports', receipt.reportId));
  assert.equal(report.data().ownerUid, owner.auth.currentUser.uid);
  assert.equal(report.data().moderationStatus, 'pending');
  assert.equal(report.data().publicationStatus, 'hidden');
  assert.equal(report.data().handoffStatus, 'not-sent');
  assert.equal(report.data().rawMediaPaths.length, 3);
  for (const path of report.data().rawMediaPaths) {
    const [bytes] = await adminStorage(admin).bucket().file(path).download();
    assert.equal((await sharp(bytes).metadata()).exif, undefined);
    await assert.rejects(getBytes(ref(owner.storage, path)), { code: 'storage/unauthorized' });
  }
  await assert.rejects(
    uploadBytes(ref(owner.storage, 'private/bypass.jpg'), new Uint8Array([1, 2])),
    { code: 'storage/unauthorized' },
  );
  await assert.rejects(
    setDoc(doc(owner.db, 'reports', 'bypass'), { ownerUid: owner.auth.currentUser.uid }),
    { code: 'permission-denied' },
  );
  const other = resident();
  await signInAnonymously(other.auth);
  await assert.rejects(getDoc(doc(other.db, 'reports', receipt.reportId)), {
    code: 'permission-denied',
  });
  // A validation failure creates no report; a corrected payload must use a new ID.
  const bad = {
    ...input,
    submissionId: randomUUID(),
    photos: input.photos.map((photo) => ({
      ...photo,
      base64: Buffer.from('not a jpeg').toString('base64'),
    })),
  };
  await assert.rejects(owner.send(bad), { code: 'functions/invalid-argument' });
  // A definite photo rejection can be corrected without inventing a new submission.
  assert.equal((await owner.send({ ...input, submissionId: bad.submissionId })).data.photoCount, 3);
  const quotaId = `${owner.auth.currentUser.uid}_${new Date().toISOString().slice(0, 10)}`;
  await adminDb(admin).collection('reportRateLimits').doc(quotaId).update({ count: 10 });
  await assert.rejects(owner.send({ ...input, submissionId: randomUUID() }), {
    code: 'functions/resource-exhausted',
  });
  // Completed retries still return the same receipt after the daily limit is reached.
  assert.equal((await owner.send(input)).data.reportId, receipt.reportId);
  console.log(
    'PASS: authenticated 3-photo intake, JPEG sanitization, concurrent retries, private rules, owner reads and daily quota.',
  );
} finally {
  await Promise.all(apps.map(deleteApp));
  await admin.delete();
  if (httpServer)
    await new Promise((resolve, reject) =>
      httpServer.close((error) => (error ? reject(error) : resolve())),
    );
}
