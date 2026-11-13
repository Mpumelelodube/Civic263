import assert from 'node:assert/strict';
import test from 'node:test';
import {
  effectiveReminderPreferences,
  eligibleReminder,
  maySendReminder,
  nearbyReminderTargets,
  recordReminder,
  reminderDay,
} from './review-reminders.ts';
import type { PublicIncident } from './models.ts';
import { DEFAULT_COMMUNITY_PREFERENCES } from './community.ts';

const now = Date.now();
const issue = {
  id: 'a'.repeat(40),
  workflowStatus: 'received',
  location: { latitude: -17.8, longitude: 31 },
} as PublicIncident;
const enabled = { ...DEFAULT_COMMUNITY_PREFERENCES, nearbyAlerts: true };
test('a local pause overrides a stale server preference without disabling volunteering or inbox push', () => {
  const server = { ...enabled, reviewer: true, pushUpdates: true, backgroundAlerts: true };
  assert.deepEqual(effectiveReminderPreferences(server, true), {
    ...server,
    nearbyAlerts: false,
    backgroundAlerts: false,
  });
  assert.deepEqual(effectiveReminderPreferences(server, false, true), {
    ...server,
    backgroundAlerts: false,
  });
});
test('nearby reminders respect opt-in, active state, volunteer status and self-proposal exclusion', () => {
  assert.equal(eligibleReminder(issue, DEFAULT_COMMUNITY_PREFERENCES, []), false);
  assert.equal(eligibleReminder(issue, enabled, []), true);
  assert.equal(eligibleReminder({ ...issue, workflowStatus: 'resolved' }, enabled, []), false);
  const pending = {
    ...issue,
    workflowStatus: 'resolution-pending' as const,
    communityResolution: {
      status: 'awaiting-confirmation' as const,
      fixId: 'b'.repeat(40),
      reportedFixedAt: new Date(now).toISOString(),
    },
  };
  assert.equal(eligibleReminder(pending, enabled, []), false);
  assert.equal(eligibleReminder(pending, { ...enabled, reviewer: true }, []), true);
  assert.equal(
    eligibleReminder(pending, { ...enabled, reviewer: true }, [pending.communityResolution.fixId]),
    false,
  );
});
test('nearby geofences are bounded, within 5 km, and selected by distance', () => {
  const list = Array.from({ length: 25 }, (_, index) => ({
    ...issue,
    id: String(index),
    location: { latitude: -17.8 + index * 0.001, longitude: 31 },
  }));
  const selected = nearbyReminderTargets([...list].reverse(), issue.location!, enabled, []);
  assert.equal(selected.length, 18);
  assert.equal(selected[0]!.id, '0');
  assert.equal(
    nearbyReminderTargets(
      [{ ...issue, location: { latitude: 0, longitude: 0 } }],
      issue.location!,
      enabled,
      [],
    ).length,
    0,
  );
});
test('nearby prompts have a per-issue 24-hour cooldown and three-per-day cap', () => {
  let ledger = { day: reminderDay(now), count: 0, issues: {} };
  assert.equal(maySendReminder('a', ledger, now), true);
  ledger = recordReminder('a', ledger, now);
  assert.equal(maySendReminder('a', ledger, now + 1000), false);
  ledger = recordReminder('b', ledger, now);
  ledger = recordReminder('c', ledger, now);
  assert.equal(maySendReminder('d', ledger, now), false);
  assert.equal(maySendReminder('a', ledger, now + 86400001), true);
});

test('local push pause overrides stale account preferences during identity changes', () => {
  const preferences = {
    reviewer: true,
    nearbyAlerts: true,
    backgroundAlerts: true,
    pushUpdates: true,
  };
  assert.equal(effectiveReminderPreferences(preferences, false, false, true).pushUpdates, false);
  assert.equal(effectiveReminderPreferences(preferences).pushUpdates, true);
});
