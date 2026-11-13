import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp as initializeAdmin } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
  createUserWithEmailAndPassword,
  getIdTokenResult,
  confirmPasswordReset,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import {
  linkResidentIdentity,
  restoreResidentIdentity,
  requestResidentPasswordReset,
  residentEmail,
  identityError,
} from '../apps/mobile/src/services/identity-commands.ts';
process.env.GCLOUD_PROJECT = 'demo-civic263';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
initializeAdmin({ projectId: 'demo-civic263' });
function client() {
  const app = initializeApp(
    { projectId: 'demo-civic263', apiKey: 'demo-only', appId: '1:123:web:demo' },
    randomUUID(),
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(app, 'europe-west1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return { auth, functions };
}
const email = 'recovery-' + randomUUID() + '@example.invalid',
  password = 'Demo-only-' + randomUUID();
const a = client();
await signInAnonymously(a.auth);
const uid = a.auth.currentUser.uid;
await adminAuth().setCustomUserClaims(uid, { civic263Test: true });
const reportId = randomUUID().replaceAll('-', '') + '12345678',
  now = new Date().toISOString();
await getFirestore()
  .doc('reports/' + reportId)
  .set({
    ownerUid: uid,
    categoryId: 'roads',
    description: 'EMULATOR ONLY identity-recovery fixture',
    landmark: 'EMULATOR ONLY',
    rawMediaPaths: [],
    createdAt: now,
    moderationStatus: 'pending',
    publicationStatus: 'hidden',
    workflowStatus: 'received',
    handoffStatus: 'not-sent',
    reviewStatus: 'held',
    receipt: {
      testOnly: true,
      reportId,
      reference: 'IDENTITY-DEMO-ONLY',
      photoCount: 0,
      receivedAt: now,
    },
  });
assert.equal(residentEmail('  TEST@EXAMPLE.INVALID '), 'test@example.invalid');
assert.throws(() => residentEmail('not an email'));
await assert.rejects(linkResidentIdentity(a.auth, email, 'short'));
assert.equal(a.auth.currentUser.uid, uid);
await linkResidentIdentity(a.auth, email, password);
assert.equal(a.auth.currentUser.uid, uid);
assert.equal(a.auth.currentUser.isAnonymous, false);
assert.equal((await getIdTokenResult(a.auth.currentUser, true)).claims.civic263Test, true);
console.log('PASS: linking preserves owner UID, existing private report and server test claims');
const b = client();
await signInAnonymously(b.auth);
const freshUid = b.auth.currentUser.uid;
await assert.rejects(restoreResidentIdentity(b.auth, email, password, true));
assert.equal(b.auth.currentUser.uid, freshUid);
await assert.rejects(restoreResidentIdentity(b.auth, email, password + 'incorrect', false));
assert.equal(b.auth.currentUser.uid, freshUid);
await assert.rejects(linkResidentIdentity(b.auth, email, password));
assert.equal(b.auth.currentUser.uid, freshUid);
await assert.rejects(httpsCallable(b.functions, 'getMyReport')({ reportId }));
console.log(
  'PASS: failed credentials, duplicate linking and unsaved-identity guards preserve the current account; foreign originals stay inaccessible',
);
await restoreResidentIdentity(b.auth, email, password, false);
assert.equal(b.auth.currentUser.uid, uid);
const response = await httpsCallable(b.functions, 'getMyReport')({ reportId });
assert.equal(response.data.id, reportId);
console.log('PASS: a separate client recovers the same account and private report');
await requestResidentPasswordReset(b.auth, email);
const codes = await (
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-civic263/oobCodes')
).json();
const code = codes.oobCodes.find((c) => c.email === email && c.requestType === 'PASSWORD_RESET');
assert.ok(code);
const replacement = 'Demo-reset-' + randomUUID();
await confirmPasswordReset(b.auth, code.oobCode, replacement);
const c = client();
await signInAnonymously(c.auth);
await assert.rejects(signInWithEmailAndPassword(c.auth, email, password));
await restoreResidentIdentity(c.auth, email, replacement, false);
assert.equal(c.auth.currentUser.uid, uid);
assert.equal(
  identityError({ code: 'auth/user-not-found' }),
  identityError({ code: 'auth/wrong-password' }),
);
console.log(
  'PASS: password recovery retains report ownership and rejects the old password; sign-in errors do not disclose account existence',
);
console.log(
  'Identity recovery checks passed against demo emulators only. No real emails sent or credentials persisted.',
);
