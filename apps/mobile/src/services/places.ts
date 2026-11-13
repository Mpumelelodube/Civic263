import { httpsCallable } from 'firebase/functions';
import type { LocatedPlace, PlaceLookupInput, PlaceSuggestion } from '@civic263/domain';
import { residentServices } from './firebase';

async function lookup(input: PlaceLookupInput) {
  const { functions } = await residentServices();
  return (
    await httpsCallable<PlaceLookupInput, { suggestions: PlaceSuggestion[] } | LocatedPlace>(
      functions,
      'lookupPlace',
      { timeout: 16000 },
    )(input)
  ).data;
}
export async function searchPlaces(
  input: string,
  sessionToken: string,
  bias?: { latitude: number; longitude: number },
) {
  const result = await lookup({
    action: 'autocomplete',
    input,
    sessionToken,
    ...(bias ? { bias } : {}),
  });
  if (!('suggestions' in result) || !Array.isArray(result.suggestions))
    throw new Error('The place search could not be read.');
  return result.suggestions;
}
export async function placeDetails(placeId: string, sessionToken: string) {
  const result = await lookup({ action: 'details', placeId, sessionToken });
  if (!('latitude' in result)) throw new Error('This address could not be confirmed.');
  return result;
}
export async function reverseGeocode(latitude: number, longitude: number) {
  const result = await lookup({ action: 'reverse', latitude, longitude });
  if (!('latitude' in result)) throw new Error('No address was found here.');
  return result;
}
export function placeLookupError() {
  return 'Address search is unavailable right now. Enter a landmark or pick a spot on the map.';
}
