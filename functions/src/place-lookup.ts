import { HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { isValidCoordinate } from '../../packages/domain/src/validation.ts';
import {
  parsePlaceLookup,
  type LocatedPlace,
  type PlaceLookupInput,
  type PlaceSuggestion,
} from '../../packages/domain/src/locations.ts';

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
const string = (value: unknown) => (typeof value === 'string' ? value : '');

// shortcut: the existing key supports Places Legacy; migrate when its owner enables Places (New).
// Provider errors never expose the server-only key or request URL.
export async function queryGooglePlaces(
  input: PlaceLookupInput,
  key: string,
  request: typeof fetch = fetch,
): Promise<{ suggestions: PlaceSuggestion[] } | LocatedPlace> {
  const params = new URLSearchParams({ key, language: 'en' });
  let endpoint: string;
  if (input.action === 'autocomplete') {
    endpoint = 'place/autocomplete/json';
    params.set('input', input.input);
    params.set('sessiontoken', input.sessionToken);
    params.set('components', 'country:zw');
    const center = input.bias ?? { latitude: -17.8252, longitude: 31.0335 };
    params.set('location', `${center.latitude},${center.longitude}`);
    params.set('radius', '50000');
  } else if (input.action === 'details') {
    endpoint = 'place/details/json';
    params.set('place_id', input.placeId);
    params.set('sessiontoken', input.sessionToken);
    params.set('fields', 'place_id,formatted_address,geometry/location');
  } else {
    endpoint = 'geocode/json';
    params.set('latlng', `${input.latitude},${input.longitude}`);
  }
  let result: JsonRecord;
  try {
    const response = await request(`https://maps.googleapis.com/maps/api/${endpoint}?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Provider request failed.');
    result = record(await response.json());
  } catch {
    throw new HttpsError(
      'unavailable',
      'Address search is unavailable. You can still choose a pin on the map.',
    );
  }
  if (result.status === 'ZERO_RESULTS') {
    if (input.action === 'autocomplete') return { suggestions: [] };
    throw new HttpsError('not-found', 'No address was found here. You can use the pin location.');
  }
  if (result.status !== 'OK')
    throw new HttpsError(
      'unavailable',
      'Address lookup is unavailable. You can use the pin location.',
    );
  if (input.action === 'autocomplete') {
    const predictions = Array.isArray(result.predictions) ? result.predictions : [];
    return {
      suggestions: predictions.slice(0, 5).flatMap((value) => {
        const prediction = record(value);
        const format = record(prediction.structured_formatting);
        const placeId = string(prediction.place_id);
        const title = string(format.main_text);
        return placeId && title
          ? [{ placeId, title, subtitle: string(format.secondary_text) }]
          : [];
      }),
    };
  }
  if (input.action === 'details') {
    const place = record(result.result);
    const point = record(record(place.geometry).location);
    if (
      typeof point.lat === 'number' &&
      typeof point.lng === 'number' &&
      isValidCoordinate(point.lat, point.lng) &&
      typeof place.formatted_address === 'string'
    )
      return {
        latitude: point.lat,
        longitude: point.lng,
        label: place.formatted_address.slice(0, 200),
        placeId: input.placeId,
      };
  } else {
    const first = record(Array.isArray(result.results) ? result.results[0] : null);
    if (typeof first.formatted_address === 'string')
      return {
        latitude: input.latitude,
        longitude: input.longitude,
        label: first.formatted_address.slice(0, 200),
        ...(typeof first.place_id === 'string' ? { placeId: first.place_id } : {}),
      };
  }
  throw new HttpsError(
    'unavailable',
    'The address could not be confirmed. You can choose a pin instead.',
  );
}

export async function receivePlaceLookup(data: unknown, uid: string, key: string) {
  let input: PlaceLookupInput;
  try {
    input = parsePlaceLookup(data);
  } catch {
    throw new HttpsError('invalid-argument', 'Invalid place lookup.');
  }
  if (!key)
    throw new HttpsError(
      'failed-precondition',
      'Address search is not connected yet. Pick a spot on the map or enter a landmark.',
    );
  const now = Date.now();
  const window = Math.floor(now / 60000);
  const limit = getFirestore().collection('placeLookupQuotas').doc(uid);
  await getFirestore().runTransaction(async (transaction) => {
    const previous = (await transaction.get(limit)).data();
    const count = previous?.window === window ? Number(previous.count) : 0;
    if (count >= 60)
      throw new HttpsError(
        'resource-exhausted',
        'Please pause before searching again. You can still choose a pin.',
      );
    transaction.set(limit, { window, count: count + 1, expiresAt: new Date(now + 86400000) });
  });
  return queryGooglePlaces(input, key);
}
