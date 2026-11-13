import { uuid } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import {
  UUID_PATTERN,
  PHOTO_LIMITS,
  validateDraft,
  parseReportLocation,
  type CategoryId,
  type DraftPhoto,
  type ReportDraft,
  type ReportLocation,
} from '@civic263/domain';

import { readSavedDrafts } from './read-saved-drafts';

function draftDirectory() {
  const directory = new Directory(Paths.document, 'civic263-drafts');
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function parseDraft(text: string): ReportDraft {
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
          !photo.uri.startsWith(Paths.document.uri) ||
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
  return draft as ReportDraft;
}

export async function loadDrafts() {
  const files = draftDirectory()
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.extension === '.json');
  return readSavedDrafts(files.map((file) => async () => parseDraft(await file.text())));
}

export async function saveDraft(input: {
  categoryId: CategoryId;
  description: string;
  landmark: string;
  photos?: DraftPhoto[];
  location?: ReportLocation;
}): Promise<ReportDraft> {
  const errors = validateDraft(input);
  if (errors.length) throw new Error(errors.join(' '));
  const now = new Date().toISOString();
  const draft: ReportDraft = {
    id: uuid.v4(),
    categoryId: input.categoryId,
    description: input.description.trim(),
    landmark: input.landmark.trim(),
    createdAt: now,
    updatedAt: now,
    state: 'draft',
    photos: input.photos ?? [],
    ...(input.location ? { location: input.location } : {}),
  };
  return updateDraft(draft);
}

export async function loadDraft(id: string): Promise<ReportDraft> {
  if (!UUID_PATTERN.test(id)) throw new Error('Invalid draft identifier.');
  return parseDraft(await new File(draftDirectory(), id + '.json').text());
}

export async function updateDraft(draft: ReportDraft): Promise<ReportDraft> {
  parseDraft(JSON.stringify(draft));
  const directory = draftDirectory();
  // A separate file per draft avoids replacing other saved drafts. Only finalized
  // JSON files appear in the list; an interrupted temporary write is not a report.
  const temporary = new File(directory, draft.id + '.tmp');
  temporary.create({ overwrite: true });
  await temporary.write(JSON.stringify(draft));
  const destination = new File(directory, draft.id + '.json');
  // Finalize only after the asynchronous write is complete.
  await temporary.move(destination, { overwrite: true });
  return draft;
}
