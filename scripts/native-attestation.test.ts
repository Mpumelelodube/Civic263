import assert from 'node:assert/strict';
import test from 'node:test';
import { readNativeAttestation } from '../apps/mobile/src/services/read-native-attestation.ts';
test('native attestation accepts only a current token for the configured project', () => {
  const value = {
    token: 'header.payload.signature',
    projectId: 'civic263-df6ec',
    expireTimeMillis: 9000,
  };
  assert.deepEqual(readNativeAttestation(value, 'civic263-df6ec', 1000), {
    token: value.token,
    expireTimeMillis: 9000,
  });
  for (const bad of [
    null,
    {},
    { ...value, projectId: 'another-project' },
    { ...value, expireTimeMillis: 1000 },
    { ...value, expireTimeMillis: Infinity },
    { ...value, token: 'not-a-token' },
  ])
    assert.throws(() => readNativeAttestation(bad, 'civic263-df6ec', 1000));
});
