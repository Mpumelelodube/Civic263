import { uuid } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { validateDraft, type CategoryId, type ReportDraft } from '@civic263/domain';

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
  return draft as ReportDraft;
}

export async function loadDrafts(): Promise<ReportDraft[]> {
  const files = draftDirectory()
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.extension === '.json');
  const drafts = await Promise.all(files.map(async (file) => parseDraft(await file.text())));
  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveDraft(input: {
  categoryId: CategoryId;
  description: string;
  landmark: string;
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
  };
  const directory = draftDirectory();
  // A separate file per draft avoids replacing other saved drafts. Only finalized
  // JSON files appear in the list; an interrupted temporary write is not a report.
  const temporary = new File(directory, draft.id + '.tmp');
  temporary.create();
  temporary.write(JSON.stringify(draft));
  temporary.move(new File(directory, draft.id + '.json'));
  return draft;
}
