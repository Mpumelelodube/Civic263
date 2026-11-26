import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import {
  buildDecisionRequest,
  checkReport,
  decide,
  DECISIONS_URL,
  NO_AREA,
  sendDecisions,
  type DecisionRequest,
} from './automatic-review.ts';
import { reportRequest, toResidentReport } from './report-access.ts';

const item = {
  categoryId: 'water',
  description:
    'Water has been flowing from a burst pipe for two days. Call Tendai on 0771 234 567.',
  landmark: 'Avondale shops',
};
const images = ['data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB'];
type Value = number | 'refusal' | { top: string; p: number };
/** Builds a provider response in question order; photos default to publishable, text to clean. */
function respond(request: DecisionRequest, values: Record<string, Value> = {}) {
  const defaults: Record<string, Value> = {
    relevant: 0.97,
    personal: 0.02,
    harmful: 0.01,
    public_place: 0.95,
    problem: { top: 'water-leak', p: 0.9 },
  };
  return {
    answers: request.questions.map((question) => {
      const value = values[question.name] ??
        defaults[question.name] ?? { top: 'publishable', p: 0.95 };
      if (value === 'refusal') return { type: 'refusal', name: question.name };
      if (typeof value === 'number')
        return { type: 'predicate', name: question.name, probability: value };
      return {
        type: 'choice',
        name: question.name,
        choice: value.top,
        confidence: value.p,
        probabilities: [{ value: value.top, probability: value.p }],
      };
    }),
  };
}

test('automatic review asks fixed questions and keeps resident text as untrusted data', () => {
  const request = buildDecisionRequest(item, images, 'report');
  assert.equal(request.model, 'gpt-6-luna');
  assert.deepEqual(
    request.questions.map((question) => question.name),
    ['relevant', 'personal', 'harmful', 'public_place', 'problem', 'photo_0', 'photo_1'],
  );
  // The resident's words travel only as JSON data, never inside a question.
  assert.equal(JSON.stringify(request.questions).includes('Tendai'), false);
  assert.equal(JSON.stringify(request.input).includes('Tendai'), true);
  const photo = request.questions[5] as { instructions: { type: string; image_url?: string }[] };
  assert.equal(photo.instructions[1]?.image_url, images[0]);
  const follow = buildDecisionRequest(item, images.slice(0, 1), 'resolution');
  assert.deepEqual(
    follow.questions.map((question) => question.name),
    ['photo_0'],
  );
  assert.equal(JSON.stringify(follow.input).includes('Tendai'), false);
});

test('automatic publication uses standard wording, never the resident’s own words', () => {
  const request = buildDecisionRequest(item, images, 'report');
  const decision = decide(
    request.questions,
    respond(request, { photo_1: { top: 'people', p: 0.8 } }),
    item,
    'report',
  );
  assert.equal(decision.publish, true);
  assert.deepEqual(decision.safePhotos, [0]);
  assert.equal(decision.title, 'Burst pipe or water leak near Avondale shops');
  assert.equal(
    decision.summary,
    'A resident reported a burst pipe or water leak near Avondale shops.',
  );
  assert.equal(decision.area, 'Avondale shops');
  assert.equal(`${decision.title}${decision.summary}`.includes('Tendai'), false);
  assert.equal(decision.scores?.photo_1, 0);
  // An unsure problem type or a landmark that is not a public place falls back to general wording.
  const general = decide(
    request.questions,
    respond(request, { problem: { top: 'no-water', p: 0.6 }, public_place: 0.4 }),
    item,
    'report',
  );
  assert.equal(general.title, 'Water supply');
  assert.equal(general.summary, 'A resident reported a problem with water supply.');
  assert.equal(general.area, NO_AREA);
  const textOnly = buildDecisionRequest({ ...item, categoryId: 'other' }, [], 'report');
  const other = decide(
    textOnly.questions,
    respond(textOnly, { problem: { top: 'other', p: 0.9 } }),
    { ...item, categoryId: 'other' },
    'report',
  );
  assert.equal(other.publish, true);
  assert.equal(
    other.summary,
    'A resident reported a municipal service problem near Avondale shops.',
  );
  // Contact details in a landmark used as the public area stop publication.
  const phone = { ...item, landmark: 'Shop 0771 234 567' };
  assert.equal(decide(request.questions, respond(request), phone, 'report').reason, 'privacy');
});

test('automatic review holds uncertain, personal, harmful, irrelevant and unsafe-photo reports', () => {
  const request = buildDecisionRequest(item, images, 'report');
  const reason = (values: Record<string, Value>) => {
    const decision = decide(request.questions, respond(request, values), item, 'report');
    assert.equal(decision.publish, false);
    assert.deepEqual(decision.safePhotos, []);
    assert.equal(decision.summary, '');
    return decision.reason;
  };
  assert.equal(reason({ personal: 0.1 }), 'privacy');
  assert.equal(reason({ harmful: 0.4 }), 'unsafe');
  assert.equal(reason({ relevant: 0.7 }), 'uncertain');
  assert.equal(reason({ relevant: 0.2 }), 'irrelevant');
  assert.equal(reason({ personal: 'refusal' }), 'uncertain');
  const bad = (top: string, p = 0.6) => ({ top, p });
  assert.equal(reason({ photo_0: bad('graphic'), photo_1: bad('people') }), 'unsafe');
  assert.equal(reason({ photo_0: bad('irrelevant'), photo_1: bad('irrelevant') }), 'irrelevant');
  assert.equal(reason({ photo_0: bad('text'), photo_1: 'refusal' }), 'privacy');
  assert.equal(reason({ photo_0: bad('publishable', 0.89), photo_1: bad('private') }), 'privacy');
});

test('follow-up photos publish only when at least one photo is clearly safe', () => {
  const request = buildDecisionRequest(item, images, 'resolution');
  const kept = decide(
    request.questions,
    respond(request, { photo_0: { top: 'text', p: 0.7 } }),
    item,
    'resolution',
  );
  assert.equal(kept.publish, true);
  assert.deepEqual(kept.safePhotos, [1]);
  assert.equal(kept.summary, '');
  const none = decide(
    request.questions,
    respond(request, { photo_0: { top: 'people', p: 0.9 }, photo_1: 'refusal' }),
    item,
    'resolution',
  );
  assert.equal(none.publish, false);
  assert.equal(none.reason, 'privacy');
});

test('malformed provider answers fail closed', () => {
  const request = buildDecisionRequest(item, images, 'report');
  const good = respond(request);
  const variants = [
    null,
    {},
    { answers: good.answers.slice(1) },
    { answers: good.answers.map((answer, index) => (index ? answer : { ...answer, name: 'x' })) },
    {
      answers: good.answers.map((answer, index) =>
        index ? answer : { ...answer, probability: 1.2 },
      ),
    },
    {
      answers: good.answers.map((answer, index) =>
        index ? answer : { ...answer, type: 'choice' },
      ),
    },
    {
      answers: good.answers.map((answer, index) =>
        index === 5 ? { ...answer, choice: 'unknown-choice' } : answer,
      ),
    },
    {
      answers: good.answers.map((answer, index) =>
        index === 5 ? { ...answer, probabilities: 'high' } : answer,
      ),
    },
  ];
  for (const response of variants)
    assert.throws(
      () => decide(request.questions, response, item, 'report'),
      /Invalid review answers/,
    );
});

test('the provider call sends downsized photos with the secret key and fails on HTTP errors', async () => {
  const large = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: 'grey' },
  })
    .jpeg()
    .toBuffer();
  let sent: DecisionRequest | undefined;
  const decision = await checkReport(item, [large], 'report', async (request) => {
    sent = request;
    return respond(request);
  });
  assert.equal(decision.publish, true);
  const photo = sent!.questions[5] as { instructions: { image_url?: string }[] };
  const url = photo.instructions[1]!.image_url!;
  assert.match(url, /^data:image\/jpeg;base64,/);
  const size = await sharp(Buffer.from(url.split(',')[1]!, 'base64')).metadata();
  assert.equal(Math.max(size.width!, size.height!), 1024);
  await assert.rejects(
    checkReport(item, [], 'resolution', async () => ({})),
    /Missing evidence/,
  );

  const saved = {
    fetch: globalThis.fetch,
    project: process.env.GCLOUD_PROJECT,
    key: process.env.OPENAI_API_KEY,
  };
  const calls: { url: string; init: RequestInit }[] = [];
  try {
    process.env.GCLOUD_PROJECT = 'civic263-unit';
    process.env.OPENAI_API_KEY = 'test-key';
    let status = 200;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ answers: [] }), { status });
    }) as typeof fetch;
    const request = buildDecisionRequest(item, [], 'report');
    assert.deepEqual(await sendDecisions(request), { answers: [] });
    assert.equal(calls[0]?.url, DECISIONS_URL);
    assert.equal(
      (calls[0]?.init.headers as Record<string, string>).Authorization,
      'Bearer test-key',
    );
    status = 429;
    await assert.rejects(sendDecisions(request), /HTTP 429/);
    process.env.GCLOUD_PROJECT = 'demo-civic263';
    await assert.rejects(sendDecisions(request), /configured review provider/);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [name, value] of [
      ['GCLOUD_PROJECT', saved.project],
      ['OPENAI_API_KEY', saved.key],
    ] as const)
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
  }
});

test('resident responses explicitly project owner fields and validate report identifiers', () => {
  const data = {
    receipt: { reference: 'C263-ABC' },
    categoryId: 'water',
    description: 'A leaking pipe.',
    landmark: 'Nearby road',
    createdAt: new Date().toISOString(),
    moderationStatus: 'pending',
    publicationStatus: 'hidden',
    workflowStatus: 'received',
    rawMediaPaths: ['private/secret.jpg'],
    ownerUid: 'private-owner',
    internalNotes: 'private staff note',
    reviewLease: 'private-lease',
  };
  const record = toResidentReport({ id: 'a'.repeat(40), data: () => data } as unknown as Parameters<
    typeof toResidentReport
  >[0]);
  assert.equal(record.photoCount, 1);
  assert.equal(record.reviewStatus, 'queued');
  assert.equal(JSON.stringify(record).includes('private-'), false);
  assert.equal(JSON.stringify(record).includes('private/'), false);
  assert.equal(reportRequest({}, 'cursor', true), null);
  assert.equal(reportRequest({ reportId: 'a'.repeat(40) }, 'reportId'), 'a'.repeat(40));
  assert.throws(() => reportRequest({ reportId: '../private' }, 'reportId'));
  assert.throws(() => reportRequest({ reportId: 'a'.repeat(40), ownerUid: 'other' }, 'reportId'));
});
