import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = 'demo-civic263';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-civic263' });
const { submitReport } = await import('../functions/lib/index.js');
const uid = `field-access-${randomUUID()}`;
const command = { action: 'community-field-test', operation: 'state' };
const invoke = (token, data = command) => submitReport.run({ auth: { uid, token }, data });
for (const token of [
  {},
  { civic263Test: true },
  { civic263Test: true, civic263FieldTestUntil: Date.now() - 1 },
  { civic263Test: true, civic263FieldTestUntil: String(Date.now() + 3600000) },
  { civic263FieldTestUntil: Date.now() + 3600000 },
]) {
  await assert.rejects(invoke(token), { code: 'permission-denied' });
  assert.equal((await invoke(token, { action: 'community-profile' })).testIdentity, undefined);
}
const accepted = { civic263Test: true, civic263FieldTestUntil: Date.now() + 3600000 };
assert.deepEqual(await invoke(accepted), { session: null });
assert.equal((await invoke(accepted, { action: 'community-profile' })).testIdentity, true);
console.log(
  'PASS: callable controller rejects missing, expired, mistyped and non-QA grants; only a current scoped grant enables private testing. Demo emulator only.',
);
