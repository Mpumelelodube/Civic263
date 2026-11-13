import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceFieldTest, type FieldTestSession } from './field-test.ts';
test('private field tests require leaving and returning before a notification and retain idempotent ordered events', () => {
  const initial: FieldTestSession = {
    id: 'a'.repeat(40),
    location: { latitude: -17.8, longitude: 31 },
    expiresAt: new Date(100000).toISOString(),
    status: 'waiting-to-leave',
    events: [],
  };
  assert.equal(advanceFieldTest(initial, 'entered', 'geofence', 1000), initial);
  assert.equal(advanceFieldTest(initial, 'notified', 'movement', 1000), initial);
  const outside = advanceFieldTest(initial, 'left', 'geofence', 1000);
  assert.equal(outside.status, 'outside');
  assert.equal(advanceFieldTest(outside, 'left', 'movement', 1100), outside);
  const returned = advanceFieldTest(outside, 'entered', 'geofence', 2000);
  const done = advanceFieldTest(returned, 'notified', 'geofence', 2100);
  assert.equal(done.status, 'notified');
  assert.equal(done.events.length, 3);
  assert.equal(advanceFieldTest(done, 'entered', 'geofence', 2200), done);
  assert.throws(() => advanceFieldTest(initial, 'left', 'movement', 100001));
});
