import assert from 'node:assert/strict';
import test from 'node:test';
import {
  draftPhotoPath,
  restoreDraftPhotoUri,
} from '../apps/mobile/src/services/draft-photo-path.ts';
import { parseSavedDraft, serializeSavedDraft } from '../apps/mobile/src/services/saved-draft.ts';
import { readSavedDrafts } from '../apps/mobile/src/services/read-saved-drafts.ts';
import type { ReportDraft } from '@civic263/domain';

const id = '9e2a6e54-6c0a-4e71-8817-a99cd119ff01';
const root =
  'file:///var/mobile/Containers/Data/Application/322f1bf6-20a1-4d2d-8c5f-f0398ad32150/Documents/';
const oldRoot =
  'file:///var/mobile/Containers/Data/Application/7ff93a77-1425-440f-9414-704c56fa8315/Documents/';
const path = `civic263-photos/${id}.jpg`;

test('saved relative and current absolute photo paths resolve against current Documents', () => {
  for (const uri of [path, root + path]) {
    assert.equal(restoreDraftPhotoUri({ id, uri }, root), root + path);
    assert.equal(restoreDraftPhotoUri({ id, uri }, root.slice(0, -1)), root + path);
  }
});

test('pre-update iOS photo paths recover after container relocation, including private alias', () => {
  for (const uri of [
    oldRoot + path,
    oldRoot.replace('file:///var/', 'file:///private/var/') + path,
  ])
    assert.equal(restoreDraftPhotoUri({ id, uri }, root), root + path);
});

test('Android photos retain their current path and support relative saved paths', () => {
  const android = 'file:///data/user/0/co.zw.civic263.mobile/files/';
  assert.equal(restoreDraftPhotoUri({ id, uri: android + path }, android), android + path);
  assert.equal(restoreDraftPhotoUri({ id, uri: path }, android), android + path);
});

test('migration rejects external, mismatched, traversing and unrelated local photo paths', () => {
  for (const uri of [
    'https://example.com/' + path,
    'content://media/' + path,
    root + '../' + path,
    root + 'civic263-photos/../state.json',
    root + path + '?extra=true',
    oldRoot + path.replace(id, '59c2db0a-345e-4ae8-8a7d-3b274f5db149'),
    oldRoot + 'Library/' + path,
    'file:///unrelated/Documents/' + path,
    '../' + path,
  ])
    assert.throws(() => restoreDraftPhotoUri({ id, uri }, root));
  assert.throws(() => draftPhotoPath('../state'));
});

const draft: ReportDraft = {
  id: 'b7ee3a2a-cf66-4926-b96e-4d7bf45cd650',
  categoryId: 'roads',
  description: 'TEST ONLY: road surface damage.',
  landmark: 'TEST ONLY: library entrance',
  state: 'draft',
  createdAt: '2026-11-19T16:00:00Z',
  updatedAt: '2026-11-19T16:10:00Z',
  photos: [{ id, uri: oldRoot + path, bytes: 50000, width: 1200, height: 900 }],
};

test('a saved pre-update photo draft is readable again without changing text or the saved JSON', () => {
  const original = JSON.stringify(draft);
  const restored = parseSavedDraft(original, root);
  assert.deepEqual(restored, {
    ...draft,
    photos: [{ ...draft.photos![0], uri: root + path }],
  });
  assert.equal(JSON.stringify(draft), original);
});

test('new saves use relative photo paths and survive subsequent Documents relocations', () => {
  const restored = parseSavedDraft(JSON.stringify(draft), root);
  const stored = serializeSavedDraft(restored, root);
  assert.equal(JSON.parse(stored).photos[0].uri, path);
  assert(!stored.includes(root));
  const nextRoot = root.replace(
    '322f1bf6-20a1-4d2d-8c5f-f0398ad32150',
    'd6acbd5d-07a2-46ef-a1f2-240725e8f28d',
  );
  const next = parseSavedDraft(stored, nextRoot);
  assert.equal(next.photos?.[0].uri, nextRoot + path);
  assert.equal(serializeSavedDraft(next, nextRoot), stored);
});

test('migration preserves receipt and unconfirmed-submission markers for safe retries', () => {
  const received: ReportDraft = {
    ...draft,
    submissionStartedAt: '2026-11-19T16:12:00Z',
    receipt: {
      reportId: 'e'.repeat(40),
      reference: 'TEST ONLY',
      photoCount: 1,
      testOnly: true,
      receivedAt: '2026-11-19T16:13:00Z',
    },
  };
  const roundTrip = parseSavedDraft(serializeSavedDraft(received, root), root);
  assert.equal(roundTrip.id, received.id);
  assert.equal(roundTrip.submissionStartedAt, received.submissionStartedAt);
  assert.deepEqual(roundTrip.receipt, received.receipt);
});

test('text-only and older drafts above the current photo cap remain readable', () => {
  const textOnly = { ...draft };
  delete textOnly.photos;
  assert.deepEqual(parseSavedDraft(serializeSavedDraft(textOnly, root), root), textOnly);
  const older = { ...draft, photos: Array.from({ length: 6 }, () => draft.photos![0]) };
  assert.equal(parseSavedDraft(JSON.stringify(older), root).photos?.length, 6);
});

test('corrupt drafts still stay unreadable while a relocated draft reappears in history', async () => {
  const badUri = JSON.stringify({
    ...draft,
    photos: [{ ...draft.photos![0], uri: 'https://example.com/private.jpg' }],
  });
  assert.throws(() => serializeSavedDraft({ ...draft, description: '' }, root));
  assert.throws(() =>
    parseSavedDraft(
      JSON.stringify({ ...draft, photos: [{ ...draft.photos![0], bytes: -1 }] }),
      root,
    ),
  );
  const result = await readSavedDrafts([
    async () => parseSavedDraft(JSON.stringify(draft), root),
    async () => parseSavedDraft(badUri, root),
    async () => parseSavedDraft('{invalid', root),
  ]);
  assert.equal(result.drafts.length, 1);
  assert.equal(result.drafts[0].photos?.[0].uri, root + path);
  assert.equal(result.unreadableCount, 2);
});
