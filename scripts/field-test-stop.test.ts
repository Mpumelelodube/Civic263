import assert from 'node:assert/strict';
import test from 'node:test';
import { stopFieldTestSafely } from '../apps/mobile/src/services/field-test-stop.ts';

function recorder(options: { remote?: 'ok' | 'offline' | 'expired'; local?: 'ok' | 'fail' } = {}) {
  const calls: string[] = [];
  return {
    calls,
    steps: {
      async pauseLocally() {
        calls.push('pause');
        if (options.local === 'fail') throw new Error('task stop failed');
      },
      async stopRemotely() {
        calls.push('remote');
        if (options.remote === 'offline') throw new Error('network request failed');
        if (options.remote === 'expired') throw new Error('permission-denied');
      },
      async recordRemoteCleanup(pending: boolean) {
        calls.push(pending ? 'pending' : 'clean');
      },
    },
  };
}

test('pauses the device before any remote request', async () => {
  const { calls, steps } = recorder();
  const result = await stopFieldTestSafely(steps);
  assert.deepEqual(calls, ['pause', 'remote', 'clean']);
  assert.equal(result.remoteCleanupPending, false);
});

test('an offline server leaves the device paused and cleanup pending', async () => {
  const { calls, steps } = recorder({ remote: 'offline' });
  const result = await stopFieldTestSafely(steps);
  assert.deepEqual(calls, ['pause', 'remote', 'pending']);
  assert.equal(result.remoteCleanupPending, true);
});

test('an expired test grant leaves the device paused and cleanup pending', async () => {
  const { calls, steps } = recorder({ remote: 'expired' });
  const result = await stopFieldTestSafely(steps);
  assert.deepEqual(calls, ['pause', 'remote', 'pending']);
  assert.equal(result.remoteCleanupPending, true);
});

test('a failed local pause is reported and never contacts the server', async () => {
  const { calls, steps } = recorder({ local: 'fail' });
  await assert.rejects(stopFieldTestSafely(steps), /task stop failed/);
  assert.deepEqual(calls, ['pause']);
});
