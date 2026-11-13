import { isValidCoordinate } from './validation.ts';

export interface ReportLocation {
  latitude: number;
  longitude: number;
  source: 'map' | 'current' | 'place';
  placeId?: string;
}
export interface PlaceSuggestion {
  placeId: string;
  title: string;
  subtitle: string;
}
export interface LocatedPlace {
  latitude: number;
  longitude: number;
  label: string;
  placeId?: string;
}
export type PlaceLookupInput =
  | {
      action: 'autocomplete';
      input: string;
      sessionToken: string;
      bias?: { latitude: number; longitude: number };
    }
  | { action: 'details'; placeId: string; sessionToken: string }
  | { action: 'reverse'; latitude: number; longitude: number };

export function parseReportLocation(value: unknown): ReportLocation {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Choose a valid report location.');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) => !['latitude', 'longitude', 'source', 'placeId'].includes(key),
    ) ||
    typeof data.latitude !== 'number' ||
    typeof data.longitude !== 'number' ||
    !isValidCoordinate(data.latitude, data.longitude) ||
    !['map', 'current', 'place'].includes(String(data.source)) ||
    (data.placeId !== undefined &&
      (typeof data.placeId !== 'string' || !/^[\w-]{1,256}$/u.test(data.placeId)))
  )
    throw new Error('Choose a valid report location.');
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    source: data.source as ReportLocation['source'],
    ...(typeof data.placeId === 'string' ? { placeId: data.placeId } : {}),
  };
}

export function parsePlaceLookup(value: unknown): PlaceLookupInput {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid place lookup.');
  const data = value as Record<string, unknown>;
  const only = (keys: string[]) => Object.keys(data).every((key) => keys.includes(key));
  const token = typeof data.sessionToken === 'string' && /^[a-f\d-]{36}$/iu.test(data.sessionToken);
  if (
    data.action === 'autocomplete' &&
    only(['action', 'input', 'sessionToken', 'bias']) &&
    token &&
    typeof data.input === 'string' &&
    data.input.trim().length >= 3 &&
    data.input.length <= 200
  ) {
    let bias;
    if (data.bias !== undefined) {
      if (!data.bias || typeof data.bias !== 'object' || Array.isArray(data.bias))
        throw new Error('Invalid search area.');
      const point = data.bias as Record<string, unknown>;
      if (
        Object.keys(point).some((key) => !['latitude', 'longitude'].includes(key)) ||
        typeof point.latitude !== 'number' ||
        typeof point.longitude !== 'number' ||
        !isValidCoordinate(point.latitude, point.longitude)
      )
        throw new Error('Invalid search area.');
      bias = { latitude: point.latitude, longitude: point.longitude };
    }
    return {
      action: 'autocomplete',
      input: data.input.trim(),
      sessionToken: String(data.sessionToken),
      ...(bias ? { bias } : {}),
    };
  }
  if (
    data.action === 'details' &&
    only(['action', 'placeId', 'sessionToken']) &&
    token &&
    typeof data.placeId === 'string' &&
    /^[\w-]{1,256}$/u.test(data.placeId)
  )
    return { action: 'details', placeId: data.placeId, sessionToken: String(data.sessionToken) };
  if (
    data.action === 'reverse' &&
    only(['action', 'latitude', 'longitude']) &&
    typeof data.latitude === 'number' &&
    typeof data.longitude === 'number' &&
    isValidCoordinate(data.latitude, data.longitude)
  )
    return { action: 'reverse', latitude: data.latitude, longitude: data.longitude };
  throw new Error('Invalid place lookup.');
}
