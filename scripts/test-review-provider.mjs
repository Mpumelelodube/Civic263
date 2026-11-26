import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const sharp = createRequire(new URL('../functions/package.json', import.meta.url))('sharp');

// Live contract check of the OpenAI Decisions provider. The API key is read from stdin only
// (for example piped from Secret Manager) and is never written or displayed. Nothing is stored.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const key = input.trim();
assert(key.length > 20 && key.length < 512, 'Provide the OpenAI API key on stdin.');
process.env.GCLOUD_PROJECT = 'civic263-df6ec';
process.env.OPENAI_API_KEY = key;
const { checkReport, REVIEW_MODEL } = await import('../functions/src/automatic-review.ts');
const photos = [];
for (const background of ['red', 'green', 'blue'])
  photos.push(
    await sharp({ create: { width: 80, height: 60, channels: 3, background } })
      .jpeg()
      .toBuffer(),
  );
const synthetic = {
  categoryId: 'other',
  description:
    'ISOLATED BACKEND TEST ONLY: these are three synthetic solid colour patterns, not evidence of any municipal issue.',
  landmark: 'Test only; no actual place.',
};
for (const [attachments, purpose] of [
  [photos, 'report'],
  [[], 'report'],
  [photos, 'resolution'],
]) {
  const decision = await checkReport(synthetic, attachments, purpose);
  assert.equal(decision.publish, false);
  assert.equal(decision.safePhotos.length, 0);
  console.log(
    `PASS: live ${purpose} review held synthetic test (${attachments.length} photos, ${decision.reason}); scores ${JSON.stringify(decision.scores)}`,
  );
}
// A plausible text-only report shows how the thresholds behave on ordinary wording. It is
// informational: thresholds are tuned from real reviews, not from this one example.
const plausible = await checkReport(
  {
    categoryId: 'roads',
    description:
      'There is a deep pothole in the left lane that cars swerve to avoid. It has been there for three weeks and fills with water when it rains.',
    landmark: 'Samora Machel Avenue',
  },
  [],
  'report',
);
console.log(
  `INFO: plausible text-only report ${plausible.publish ? `would publish as "${plausible.title}"` : `would be held (${plausible.reason})`}; scores ${JSON.stringify(plausible.scores)}`,
);
console.log(`Live ${REVIEW_MODEL} contract checks passed. No reports or photos were stored.`);
