import {
  UUID_PATTERN,
  PHOTO_LIMITS,
  validateDraft,
  parseReportLocation,
  type ReportDraft,
} from '@civic263/domain';
import { draftPhotoPath, restoreDraftPhotoUri } from './draft-photo-path.ts';

export function parseSavedDraft(text: string, documentUri: string): ReportDraft {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object') throw new Error('Invalid saved draft.');
  const draft = value as Partial<ReportDraft>;
  if (
    typeof draft.id !== 'string' ||
    !UUID_PATTERN.test(draft.id) ||
    typeof draft.categoryId !== 'string' ||
    typeof draft.description !== 'string' ||
    typeof draft.landmark !== 'string' ||
    typeof draft.createdAt !== 'string' ||
    typeof draft.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(draft.createdAt)) ||
    !Number.isFinite(Date.parse(draft.updatedAt)) ||
    draft.state !== 'draft' ||
    validateDraft({
      categoryId: draft.categoryId,
      description: draft.description,
      landmark: draft.landmark,
    }).length
  )
    throw new Error('A saved draft could not be read. Its file has been preserved.');
  if (
    draft.photos !== undefined &&
    (!Array.isArray(draft.photos) ||
      // Keep older drafts readable so residents can remove photos above the new submission cap.
      draft.photos.length > 6 ||
      draft.photos.some(
        (photo) =>
          !photo ||
          !UUID_PATTERN.test(photo.id) ||
          typeof photo.uri !== 'string' ||
          !Number.isInteger(photo.bytes) ||
          photo.bytes <= 0 ||
          photo.bytes > PHOTO_LIMITS.maxBytes ||
          !Number.isInteger(photo.width) ||
          !Number.isInteger(photo.height),
      ))
  )
    throw new Error('A saved photo could not be read. Its file has been preserved.');
  if (
    draft.receipt &&
    (typeof draft.receipt.reportId !== 'string' ||
      typeof draft.receipt.reference !== 'string' ||
      !Number.isFinite(Date.parse(draft.receipt.receivedAt)))
  )
    throw new Error('A saved receipt could not be read.');
  if (draft.location !== undefined) parseReportLocation(draft.location);
  return {
    ...(draft as ReportDraft),
    ...(draft.photos
      ? {
          photos: draft.photos.map((photo) => ({
            ...photo,
            uri: restoreDraftPhotoUri(photo, documentUri),
          })),
        }
      : {}),
  };
}

export function serializeSavedDraft(draft: ReportDraft, documentUri: string): string {
  const validated = parseSavedDraft(JSON.stringify(draft), documentUri);
  return JSON.stringify({
    ...validated,
    ...(validated.photos
      ? {
          photos: validated.photos.map((photo) => ({
            ...photo,
            uri: draftPhotoPath(photo.id),
          })),
        }
      : {}),
  });
}
