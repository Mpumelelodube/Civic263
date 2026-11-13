import assert from 'node:assert/strict';
import test from 'node:test';
import { readSavedDrafts } from '../apps/mobile/src/services/read-saved-drafts.ts';
import type { ReportDraft } from '@civic263/domain';
import type { ResidentReport } from '@civic263/domain';
import {
  mergeResidentReports,
  reportHistoryRows,
} from '../apps/mobile/src/services/report-history.ts';

const draft: ReportDraft = {
  id: 'older',
  categoryId: 'roads',
  description: 'A damaged road surface.',
  landmark: 'Public library',
  createdAt: '2026-11-09T08:00:00Z',
  updatedAt: '2026-11-09T08:00:00Z',
  state: 'draft',
};

test('unreadable files do not hide readable drafts; results are newest first', async () => {
  const newer = { ...draft, id: 'newer', updatedAt: '2026-11-10T08:00:00Z' };
  const result = await readSavedDrafts([
    async () => draft,
    async () => {
      throw new Error('Unreadable file');
    },
    async () => newer,
    () => {
      throw new Error('Synchronous read failure');
    },
  ]);
  assert.deepEqual(result, { drafts: [newer, draft], unreadableCount: 2 });
});

test('empty storage and entirely unreadable storage remain distinguishable', async () => {
  assert.deepEqual(await readSavedDrafts([]), { drafts: [], unreadableCount: 0 });
  assert.deepEqual(
    await readSavedDrafts([
      async () => {
        throw new Error('Invalid JSON');
      },
    ]),
    {
      drafts: [],
      unreadableCount: 1,
    },
  );
});

const received: ResidentReport = {
  id: 'server-report',
  reference: 'TEST ONLY',
  categoryId: 'roads',
  description: 'TEST ONLY',
  landmark: 'TEST ONLY',
  createdAt: '2026-11-12T08:00:00Z',
  moderationStatus: 'pending',
  publicationStatus: 'hidden',
  workflowStatus: 'received',
  reviewStatus: 'queued',
  reviewReason: null,
  photoCount: 0,
  testOnly: true,
  incidentReference: null,
};

test('refresh replaces cached review states while preserving previously loaded reports', () => {
  const older = { ...received, id: 'older-server-report' };
  const published: ResidentReport = {
    ...received,
    reviewStatus: 'published',
    publicationStatus: 'published',
    moderationStatus: 'approved',
  };
  assert.deepEqual(mergeResidentReports([received, older], [published]), [published, older]);
});

test('history sorts drafts and receipts together and shows each received report once', () => {
  const localReceipt: ReportDraft = {
    ...draft,
    id: 'local-copy',
    receipt: {
      reportId: received.id,
      reference: received.reference,
      photoCount: 0,
      testOnly: true,
      receivedAt: received.createdAt,
    },
  };
  const recentDraft = { ...draft, id: 'recent-draft', updatedAt: '2026-11-11T08:00:00Z' };
  assert.deepEqual(
    reportHistoryRows([draft, localReceipt, recentDraft], [received]).map((row) => row.item.id),
    [received.id, recentDraft.id, draft.id],
  );
  assert.equal(reportHistoryRows([localReceipt], [])[0]?.kind, 'draft');
});
