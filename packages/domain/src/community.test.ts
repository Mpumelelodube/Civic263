import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkCommunityTransition,
  parseCommunityPreferences,
  readCommunityResolution,
  DEFAULT_COMMUNITY_PREFERENCES,
} from './community.ts';
import { isOpenIncident } from './models.ts';
import { toPublicIncident } from './publication.ts';
import type { IncidentRecord } from './models.ts';

const pending = {
  status: 'awaiting-confirmation' as const,
  fixId: 'a'.repeat(40),
  reportedFixedAt: '2026-11-13T10:00:00Z',
};
test('a fix stays active until an opted-in different identity confirms the current proposal', () => {
  assert.equal(isOpenIncident({ workflowStatus: 'resolution-pending' }), true);
  checkCommunityTransition({
    action: 'report-fix',
    workflowStatus: 'received',
    actorUid: 'other-resident',
    reviewer: false,
  });
  const review = {
    action: 'confirm-fix' as const,
    workflowStatus: 'resolution-pending' as const,
    current: pending,
    actorUid: 'reviewer',
    proposerUid: 'proposer',
    reviewer: true,
    fixId: pending.fixId,
  };
  checkCommunityTransition(review);
  checkCommunityTransition({ ...review, action: 'reject-fix' });
  for (const changed of [
    { reviewer: false },
    { actorUid: 'proposer' },
    { fixId: 'b'.repeat(40) },
    { workflowStatus: 'resolved' as const },
  ])
    assert.throws(() => checkCommunityTransition({ ...review, ...changed }));
  assert.throws(() => checkCommunityTransition({ ...review, action: 'report-fix' }));
});
test('volunteering and reminders default off; background alerts require nearby reminders', () => {
  assert.deepEqual(
    parseCommunityPreferences(DEFAULT_COMMUNITY_PREFERENCES),
    DEFAULT_COMMUNITY_PREFERENCES,
  );
  assert.throws(() =>
    parseCommunityPreferences({ ...DEFAULT_COMMUNITY_PREFERENCES, backgroundAlerts: true }),
  );
  assert.throws(() =>
    parseCommunityPreferences({ ...DEFAULT_COMMUNITY_PREFERENCES, ownerUid: 'forged' }),
  );
  assert.throws(() =>
    parseCommunityPreferences({ ...DEFAULT_COMMUNITY_PREFERENCES, reviewer: 'true' }),
  );
});
test('community status projection excludes participant identities and precise evidence locations', () => {
  const privateResolution = {
    ...pending,
    actorUid: 'PRIVATE',
    location: { latitude: -17.8, longitude: 31 },
    rawMediaPaths: ['PRIVATE'],
  };
  assert.deepEqual(readCommunityResolution(privateResolution), pending);
  assert.equal(readCommunityResolution({ ...pending, fixId: '../../reports' }), null);
  const projected = toPublicIncident({
    publicationStatus: 'published',
    workflowStatus: 'resolution-pending',
    communityResolution: privateResolution,
  } as unknown as IncidentRecord);
  assert.deepEqual(projected?.communityResolution, pending);
  assert.equal(JSON.stringify(projected).includes('PRIVATE'), false);
});
