import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { queryGooglePlaces } from './place-lookup.ts';
import { parsePlaceLookup, parseReportLocation } from '../../packages/domain/src/locations.ts';

test('place and report location boundaries reject malformed coordinates and arbitrary fields', () => {
  assert.deepEqual(parseReportLocation({ latitude: -17.8, longitude: 31, source: 'map' }), {
    latitude: -17.8,
    longitude: 31,
    source: 'map',
  });
  assert.throws(() => parseReportLocation({ latitude: NaN, longitude: 31, source: 'map' }));
  assert.throws(() => parseReportLocation({ latitude: 91, longitude: 31, source: 'map' }));
  assert.throws(() =>
    parseReportLocation({ latitude: 0, longitude: 0, source: 'map', ownerUid: 'spoof' }),
  );
  assert.throws(() => parsePlaceLookup({ action: 'reverse', latitude: 0, longitude: Infinity }));
  assert.throws(() =>
    parsePlaceLookup({ action: 'details', placeId: '../../private', sessionToken: randomUUID() }),
  );
  assert.throws(() =>
    parsePlaceLookup({ action: 'autocomplete', input: 'a', sessionToken: randomUUID() }),
  );
});

test('autocomplete restricts results to Zimbabwe and preserves the session through details', async () => {
  const token = randomUUID();
  const calls: { url: string; options: RequestInit | undefined }[] = [];
  const request: typeof fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json(
      calls.length === 1
        ? {
            status: 'OK',
            predictions: [
              {
                place_id: 'ChIJ-example',
                structured_formatting: {
                  main_text: 'Example road',
                  secondary_text: 'TEST ONLY',
                },
                privateExtra: 'must not leave server',
              },
              { queryPrediction: { text: { text: 'Not a selected place' } } },
            ],
          }
        : {
            status: 'OK',
            result: {
              place_id: 'ChIJ-example',
              formatted_address: 'TEST ONLY address',
              geometry: { location: { lat: -17, lng: 31 } },
              phone: 'excluded',
            },
          },
    );
  };
  const result = await queryGooglePlaces(
    {
      action: 'autocomplete',
      input: 'Example',
      sessionToken: token,
      bias: { latitude: 51.5074, longitude: -0.1278 },
    },
    'test-secret',
    request,
  );
  assert.deepEqual(result, {
    suggestions: [{ placeId: 'ChIJ-example', title: 'Example road', subtitle: 'TEST ONLY' }],
  });
  assert.equal(new URL(calls[0]!.url).searchParams.get('sessiontoken'), token);
  assert.equal(new URL(calls[0]!.url).searchParams.get('components'), 'country:zw');
  assert.equal(new URL(calls[0]!.url).searchParams.get('location'), '51.5074,-0.1278');
  assert(!JSON.stringify(result).includes('test-secret'));
  const details = await queryGooglePlaces(
    { action: 'details', placeId: 'ChIJ-example', sessionToken: token },
    'test-secret',
    request,
  );
  assert.deepEqual(details, {
    latitude: -17,
    longitude: 31,
    label: 'TEST ONLY address',
    placeId: 'ChIJ-example',
  });
  assert.equal(new URL(calls[1]!.url).searchParams.get('sessiontoken'), token);
  assert.equal(
    new URL(calls[1]!.url).searchParams.get('fields'),
    'place_id,formatted_address,geometry/location',
  );
});

test('reverse geocoding keeps the chosen point, and provider failures never expose secrets', async () => {
  const request: typeof fetch = async () =>
    Response.json({
      status: 'OK',
      results: [{ formatted_address: 'TEST ONLY address', place_id: 'example' }],
    });
  assert.deepEqual(
    await queryGooglePlaces(
      { action: 'reverse', latitude: -17, longitude: 31 },
      'test-secret',
      request,
    ),
    { latitude: -17, longitude: 31, label: 'TEST ONLY address', placeId: 'example' },
  );
  const fail: typeof fetch = async () => {
    throw new Error('https://private.example?key=test-secret');
  };
  await assert.rejects(
    queryGooglePlaces({ action: 'reverse', latitude: 0, longitude: 0 }, 'test-secret', fail),
    (error: unknown) => error instanceof Error && !error.message.includes('test-secret'),
  );
  await assert.rejects(
    queryGooglePlaces({ action: 'reverse', latitude: 0, longitude: 0 }, 'test-secret', async () =>
      Response.json({ status: 'ZERO_RESULTS' }),
    ),
    /No address/u,
  );
});
