import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicIncident, ResidentReportDetail } from '@civic263/domain';
import {
  loadReportDetail,
  PublicReportNotFoundError,
} from '../apps/mobile/src/services/report-detail.ts';

const owner = { id: 'a'.repeat(40) } as ResidentReportDetail;
const published = { id: owner.id } as PublicIncident;
const unexpectedRead = async (): Promise<never> => assert.fail('Unexpected report read');
const missingPublic = async (): Promise<never> => {
  throw new PublicReportNotFoundError();
};

test('explicit owner details use only the protected owner reader', async () => {
  assert.deepEqual(await loadReportDetail('owner', async () => owner, unexpectedRead), {
    kind: 'owner',
    item: owner,
  });
});

test('published links use the public record without requesting private data', async () => {
  assert.deepEqual(await loadReportDetail('public', unexpectedRead, async () => published), {
    kind: 'public',
    item: published,
  });
});

test('an unpublished link can open the server-authorized owner record', async () => {
  assert.deepEqual(await loadReportDetail('public', async () => owner, missingPublic), {
    kind: 'owner',
    item: owner,
  });
});

test('an unpublished foreign report preserves the server ownership denial', async () => {
  const denied = new Error('Not the owner');
  await assert.rejects(
    loadReportDetail(
      'public',
      async () => {
        throw denied;
      },
      missingPublic,
    ),
    (error) => error === denied,
  );
});

test('public service failures and cancellation never request private data', async () => {
  for (const failure of [
    new Error('Service unavailable'),
    new DOMException('Cancelled', 'AbortError'),
  ]) {
    await assert.rejects(
      loadReportDetail('public', unexpectedRead, async () => {
        throw failure;
      }),
      (error) => error === failure,
    );
  }
});

test('cancelling after a public 404 prevents a late private request', async () => {
  const controller = new AbortController();
  await assert.rejects(
    loadReportDetail(
      'public',
      unexpectedRead,
      async () => {
        controller.abort();
        return missingPublic();
      },
      controller.signal,
    ),
    PublicReportNotFoundError,
  );
});
