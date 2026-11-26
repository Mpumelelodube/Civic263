import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DANGER_CATEGORIES,
  EMERGENCY_GUIDANCE,
  OUTSIDE_PILOT_MESSAGE,
  SUPPORT_EMAIL,
  isDangerCategory,
  isInPilotArea,
  launchBlockers,
} from './pilot.ts';
import { parsePilotReportLocation, parseReportLocation } from './locations.ts';
import { parseReportCorrection } from './account-lifecycle.ts';
import { parseReportSubmission } from './report-submission.ts';

test('the pilot accepts all of Zimbabwe, including towns on the coarse outline edge', () => {
  const towns: [string, number, number][] = [
    ['Harare', -17.83, 31.05],
    ['Bulawayo', -20.15, 28.58],
    ['Mutare', -18.97, 32.67],
    ['Beitbridge', -22.22, 30.0],
    ['Victoria Falls', -17.93, 25.84],
    ['Chimanimani', -19.8, 32.87],
    ['Mount Selinda', -20.43, 32.71],
    ['Kanyemba', -15.65, 30.33],
    ['Nyamapanda', -16.95, 32.86],
  ];
  for (const [name, latitude, longitude] of towns)
    assert.equal(isInPilotArea(latitude, longitude), true, name);
  const elsewhere: [string, number, number][] = [
    ['Lusaka', -15.39, 28.32],
    ['Tete', -16.16, 33.59],
    ['Chimoio', -19.12, 33.48],
    ['Johannesburg', -26.2, 28.05],
    ['London', 51.51, -0.13],
    ['Null Island', 0, 0],
  ];
  for (const [name, latitude, longitude] of elsewhere)
    assert.equal(isInPilotArea(latitude, longitude), false, name);
  assert.equal(isInPilotArea(Number.NaN, 31), false);
});

test('new and corrected reports must be pinned in the pilot area; saved drafts stay readable', () => {
  const abroad = { latitude: -15.39, longitude: 28.32, source: 'map' };
  const home = { latitude: -17.83, longitude: 31.05, source: 'map' };
  assert.deepEqual(parseReportLocation(abroad), abroad, 'drafts can still be opened and moved');
  assert.throws(() => parsePilotReportLocation(abroad), { message: OUTSIDE_PILOT_MESSAGE });
  assert.deepEqual(parsePilotReportLocation(home), home);
  const submission = {
    submissionId: '6f1c2c1e-6a4b-4d2a-9a3e-2f7b1c0d9e8f',
    categoryId: 'roads',
    description: 'A deep pothole in the left lane',
    landmark: 'Main road',
    photos: [],
  };
  assert.throws(() => parseReportSubmission({ ...submission, location: abroad }), {
    message: OUTSIDE_PILOT_MESSAGE,
  });
  assert.equal(parseReportSubmission({ ...submission, location: home }).location?.latitude, -17.83);
  assert.throws(
    () =>
      parseReportCorrection({
        action: 'correct-report',
        reportId: 'a'.repeat(40),
        revision: 0,
        categoryId: 'roads',
        description: 'A deep pothole in the left lane',
        landmark: 'Main road',
        location: abroad,
        keepPhotos: [],
      }),
    { message: OUTSIDE_PILOT_MESSAGE },
  );
});

test('danger categories show help numbers, and launch stays blocked until contacts are confirmed', () => {
  assert.equal(isDangerCategory('dangerous-infrastructure'), true);
  assert.equal(isDangerCategory('road-obstruction'), true);
  assert.equal(isDangerCategory('waste'), false);
  assert.ok(DANGER_CATEGORIES.length >= 2);
  assert.ok(EMERGENCY_GUIDANCE.numbers.every((item) => /^[\d ]{3,}$/u.test(item.number)));
  assert.ok(EMERGENCY_GUIDANCE.sourceUrl.startsWith('https://'));
  const blockers = launchBlockers();
  assert.equal(
    blockers.some((item) => item.includes('SUPPORT_EMAIL')),
    SUPPORT_EMAIL === null,
  );
  assert.equal(
    blockers.some((item) => item.includes('emergency numbers')),
    !EMERGENCY_GUIDANCE.confirmedLocally,
  );
});
