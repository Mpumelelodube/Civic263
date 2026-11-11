import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell, isValidCoordinate, validateDraft } from './validation.ts';
import { toPublicIncident } from './publication.ts';
import type { IncidentRecord } from './models.ts';

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
