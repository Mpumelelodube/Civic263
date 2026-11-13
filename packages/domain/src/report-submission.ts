import { isCategoryId, type CategoryId } from './categories.ts';
import { validateDraft } from './validation.ts';
import { parseReportLocation, type ReportLocation } from './locations.ts';

export const PHOTO_LIMITS = {
  maximum: 3,
  maxBytes: 400 * 1024,
  maxSide: 1600,
} as const;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ReportPhotoInput {
  id: string;
  base64: string;
  width: number;
  height: number;
}
export interface ReportSubmissionInput {
  submissionId: string;
  categoryId: CategoryId;
  description: string;
  landmark: string;
  photos: ReportPhotoInput[];
  location?: ReportLocation;
}
export interface SubmissionReceipt {
  testOnly: boolean;
  reportId: string;
  reference: string;
  receivedAt: string;
  photoCount: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function onlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

// Shared boundary validation. The server additionally decodes and re-encodes JPEGs.
export function parseReportSubmission(value: unknown): ReportSubmissionInput {
  if (
    !record(value) ||
    !onlyKeys(value, [
      'submissionId',
      'categoryId',
      'description',
      'landmark',
      'photos',
      'location',
    ])
  )
    throw new Error('The report contains unsupported fields.');
  if (typeof value.submissionId !== 'string' || !UUID_PATTERN.test(value.submissionId))
    throw new Error('The report needs a valid submission identifier.');
  if (
    !isCategoryId(value.categoryId) ||
    typeof value.description !== 'string' ||
    typeof value.landmark !== 'string'
  )
    throw new Error('Choose a service and add the report details.');
  const errors = validateDraft({
    categoryId: value.categoryId,
    description: value.description,
    landmark: value.landmark,
  });
  if (errors.length) throw new Error(errors.join(' '));
  const photos = parsePhotoInputs(value.photos);
  if (value.location === undefined) throw new Error('Confirm a report pin before sending.');
  return {
    submissionId: value.submissionId,
    categoryId: value.categoryId,
    description: value.description.trim(),
    landmark: value.landmark.trim(),
    photos,
    location: parseReportLocation(value.location),
  };
}

export function parsePhotoInputs(value: unknown): ReportPhotoInput[] {
  if (!Array.isArray(value) || value.length > PHOTO_LIMITS.maximum)
    throw new Error(`Attach at most ${PHOTO_LIMITS.maximum} different photos.`);
  const ids = new Set<string>();
  return value.map((photo: unknown): ReportPhotoInput => {
    if (
      !record(photo) ||
      !onlyKeys(photo, ['id', 'base64', 'width', 'height']) ||
      typeof photo.id !== 'string' ||
      !UUID_PATTERN.test(photo.id) ||
      ids.has(photo.id) ||
      typeof photo.base64 !== 'string' ||
      photo.base64.length > Math.ceil(PHOTO_LIMITS.maxBytes / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(photo.base64) ||
      !photo.base64.length ||
      typeof photo.width !== 'number' ||
      typeof photo.height !== 'number' ||
      !Number.isInteger(photo.width) ||
      !Number.isInteger(photo.height) ||
      photo.width < 1 ||
      photo.height < 1 ||
      photo.width > PHOTO_LIMITS.maxSide ||
      photo.height > PHOTO_LIMITS.maxSide
    )
      throw new Error('A photo is invalid or too large. Remove it and choose it again.');
    ids.add(photo.id);
    return { id: photo.id, base64: photo.base64, width: photo.width, height: photo.height };
  });
}
