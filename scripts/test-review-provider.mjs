import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
const sharp = createRequire(new URL('../functions/package.json', import.meta.url))('sharp');

// Operator token is read from stdin only and is never written or displayed.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const token = input.trim();
assert(
  token.length > 20 && token.length < 4096,
  'Provide an ephemeral gcloud access token on stdin.',
);
process.env.GCLOUD_PROJECT = 'civic263-df6ec';
initializeApp({
  projectId: 'civic263-df6ec',
  credential: { getAccessToken: async () => ({ access_token: token, expires_in: 3600 }) },
});
const { checkReport } = await import('../functions/src/automatic-review.ts');
const photos = [];
for (const background of ['red', 'green', 'blue'])
  photos.push(
    await sharp({ create: { width: 80, height: 60, channels: 3, background } })
      .jpeg()
      .toBuffer(),
  );
for (const [attachments, purpose] of [
  [photos, 'report'],
  [[], 'report'],
  [photos, 'resolution'],
]) {
  const decision = await checkReport(
    {
      categoryId: 'other',
      description:
        'ISOLATED BACKEND TEST ONLY: these are three synthetic solid colour patterns, not evidence of any municipal issue.',
      landmark: 'Test only; no actual place.',
    },
    attachments,
    purpose,
  );
  assert.equal(decision.publish, false);
  assert.equal(decision.safePhotos.length, 0);
  console.log(
    `PASS: live ${purpose} review contract held synthetic test (${attachments.length} attachments) (${decision.reason}); no reports or photos were stored.`,
  );
}
