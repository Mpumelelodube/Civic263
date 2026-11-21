import { uuid } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import {
  UUID_PATTERN,
  validateDraft,
  type CategoryId,
  type DraftPhoto,
  type ReportDraft,
  type ReportLocation,
} from '@civic263/domain';

import { readSavedDrafts } from './read-saved-drafts';
import { parseSavedDraft, serializeSavedDraft } from './saved-draft';

function draftDirectory() {
  const directory = new Directory(Paths.document, 'civic263-drafts');
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

export async function loadDrafts() {
  const files = draftDirectory()
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.extension === '.json');
  return readSavedDrafts(
    files.map((file) => async () => parseSavedDraft(await file.text(), Paths.document.uri)),
  );
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
  return parseSavedDraft(await new File(draftDirectory(), id + '.json').text(), Paths.document.uri);
}

export async function updateDraft(draft: ReportDraft): Promise<ReportDraft> {
  const stored = serializeSavedDraft(draft, Paths.document.uri);
  const directory = draftDirectory();
  // A separate file per draft avoids replacing other saved drafts. Only finalized
  // JSON files appear in the list; an interrupted temporary write is not a report.
  const temporary = new File(directory, draft.id + '.tmp');
  temporary.create({ overwrite: true });
  await temporary.write(stored);
  const destination = new File(directory, draft.id + '.json');
  // Finalize only after the asynchronous write is complete.
  await temporary.move(destination, { overwrite: true });
  return parseSavedDraft(stored, Paths.document.uri);
}
