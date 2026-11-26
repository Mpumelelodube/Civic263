import { PHOTO_LIMITS, categoryLabel, type CategoryId } from '@civic263/domain';

export interface ReadinessItem {
  key: 'service' | 'description' | 'place' | 'photos';
  label: string;
  detail: string;
  done: boolean;
  optional: boolean;
}
/**
 * The report composer's checklist. It mirrors the draft validation rules (10 to 1,000
 * characters, a place and a confirmed pin) so residents see what is missing before sending.
 */
export function reportReadiness(input: {
  categoryId: CategoryId;
  description: string;
  landmark: string;
  hasPin: boolean;
  /** False when the pin lies outside the pilot area (Zimbabwe). */
  pinInPilotArea?: boolean;
  photoCount: number;
}): { items: ReadinessItem[]; ready: boolean } {
  const length = input.description.trim().length;
  const describedEnough = length >= 10 && length <= 1000;
  const outside = input.hasPin && input.pinInPilotArea === false;
  const placed = input.landmark.trim().length > 0 && input.hasPin && !outside;
  const items: ReadinessItem[] = [
    {
      key: 'service',
      label: 'Service',
      detail: categoryLabel(input.categoryId),
      done: true,
      optional: false,
    },
    {
      key: 'description',
      label: 'What you saw',
      detail:
        length === 0
          ? 'Add at least 10 characters'
          : length < 10
            ? `${10 - length} more ${10 - length === 1 ? 'character' : 'characters'} needed`
            : length > 1000
              ? `${length - 1000} characters over the limit`
              : `${length} characters`,
      done: describedEnough,
      optional: false,
    },
    {
      key: 'place',
      label: 'Place',
      detail: placed
        ? 'Pin confirmed'
        : outside
          ? 'Move the pin into Zimbabwe'
          : input.landmark.trim()
            ? 'Confirm a map pin'
            : 'Search for a place or drop a pin',
      done: placed,
      optional: false,
    },
    {
      key: 'photos',
      label: 'Photos',
      detail: `${input.photoCount} of ${PHOTO_LIMITS.maximum} · optional`,
      done: input.photoCount > 0,
      optional: true,
    },
  ];
  return { items, ready: items.every((item) => item.done || item.optional) };
}
