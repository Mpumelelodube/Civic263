import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell, isValidCoordinate, validateDraft } from './validation.ts';
import { toPublicIncident } from './publication.ts';
import type { IncidentRecord } from './models.ts';
import { isOpenIncident } from './models.ts';
import { parseResolutionCommand, readResolution, workflowLabel } from './report-resolution.ts';

const record: IncidentRecord = {
  id: 'example',
  reference: 'ISS-DEMO-01',
  municipalityId: 'demo',
  title: 'Fictional pothole',
  summary: 'Illustrative evidence',
  categoryId: 'roads',
  area: 'Demonstration area',
  workflowStatus: 'received',
  handoffStatus: 'not-sent',
  firstAcceptedAt: '2026-11-09T08:00:00Z',
  lastApprovedEvidenceAt: null,
  evidenceSource: 'resident-observation',
  location: { latitude: -17.8, longitude: 31 },
  locationPrecision: 'exact',
  publicationVersion: 1,
  publicationStatus: 'published',
  internalNotes: 'private',
  rawMediaPaths: ['private/original.jpg'],
};

test('unpublished and merged incidents never reach the public projection', () => {
  assert.equal(toPublicIncident({ ...record, publicationStatus: 'hidden' }), null);
  assert.equal(toPublicIncident({ ...record, workflowStatus: 'merged' }), null);
});
test('public projection excludes private fields and withheld coordinates', () => {
  const published = toPublicIncident({ ...record, locationPrecision: 'hidden' });
  assert.ok(published);
  assert.equal(published.location, null);
  assert.equal('internalNotes' in published, false);
  assert.equal('rawMediaPaths' in published, false);
  assert.deepEqual(
    Object.keys(published).sort(),
    Object.keys(record)
      .filter((key) => !['publicationStatus', 'internalNotes', 'rawMediaPaths'].includes(key))
      .sort(),
  );
});

test('resolution commands reject forged attribution and public metadata excludes the actor identity', () => {
  const location = {
    latitude: -17.8,
    longitude: 31,
    accuracyMeters: 5,
    timestamp: Date.now(),
    mocked: false,
  };
  const command = {
    action: 'resolve',
    reportId: 'a'.repeat(40),
    attemptId: '00000000-0000-4000-8000-000000000001',
    location,
    photos: [
      {
        id: '00000000-0000-4000-8000-000000000002',
        base64: '/9j/',
        width: 1,
        height: 1,
        captureSource: 'camera',
        capturedAt: location.timestamp,
        location,
      },
    ],
  };
  assert.deepEqual(parseResolutionCommand(command), command);
  for (const value of [
    null,
    [],
    {},
    { ...command, action: 'delete' },
    { ...command, reportId: '../private' },
    { ...command, ownerUid: 'someone-else' },
    { ...command, resolvedAt: '2026-11-12T00:00:00Z' },
  ])
    assert.throws(() => parseResolutionCommand(value));
  const resolution = { source: 'resident' as const, resolvedAt: '2026-11-12T08:00:00Z' };
  const published = toPublicIncident({
    ...record,
    workflowStatus: 'resolved',
    resolution: { ...resolution, actorUid: 'PRIVATE' } as typeof resolution,
  });
  assert.deepEqual(published?.resolution, resolution);
  assert.equal(JSON.stringify(published).includes('PRIVATE'), false);
  assert.equal(isOpenIncident(published!), false);
  assert.equal(workflowLabel(published!), 'Resolved by reporter');
  assert.equal(workflowLabel(published!, true), 'Resolved by you');
  assert.equal(workflowLabel({ workflowStatus: 'resolved' }), 'Resolution recorded');
  assert.equal(readResolution({ source: 'municipality', resolvedAt: resolution.resolvedAt }), null);
  assert.equal(readResolution({ source: 'resident', resolvedAt: 'invalid' }), null);
});
test('draft validation rejects empty details, unsupported category and missing landmark', () => {
  assert.equal(
    validateDraft({ categoryId: 'invented', description: 'short', landmark: '' }).length,
    3,
  );
  assert.deepEqual(
    validateDraft({
      categoryId: 'roads',
      description: 'A damaged section of the road.',
      landmark: 'Near the public library',
    }),
    [],
  );
});
test('coordinates reject non-finite and out-of-range values', () => {
  assert.equal(isValidCoordinate(-17.8, 31), true);
  for (const [lat, lng] of [
    [91, 0],
    [0, 181],
    [NaN, 0],
    [0, Infinity],
  ])
    assert.equal(isValidCoordinate(lat!, lng!), false);
});
test('CSV escapes formulas and quotes in resident-supplied text', () => {
  assert.equal(csvCell('=HYPERLINK("example")'), '"\'=HYPERLINK(""example"")"');
  assert.equal(csvCell('  +1'), '"\'  +1"');
  assert.equal(csvCell('Road "A"'), '"Road ""A"""');
  assert.equal(csvCell(0), '"0"');
  assert.equal(csvCell(-17.8), '"-17.8"');
});

test('distance supports a 5 km search and crossing the date line', async () => {
  const { distanceKm } = await import('./geo.ts');
  const centre = { latitude: -17.83, longitude: 31.05 };
  assert.equal(distanceKm(centre, centre), 0);
  assert.ok(distanceKm(centre, { ...centre, latitude: -17.8 }) < 5);
  assert.ok(distanceKm(centre, { ...centre, latitude: -17.77 }) > 5);
  assert.ok(
    distanceKm({ latitude: 0, longitude: 179.99 }, { latitude: 0, longitude: -179.99 }) < 3,
  );
});
