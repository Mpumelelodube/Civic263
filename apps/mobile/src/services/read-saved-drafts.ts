import type { ReportDraft } from '@civic263/domain';

export async function readSavedDrafts(
  readers: (() => Promise<ReportDraft>)[],
): Promise<{ drafts: ReportDraft[]; unreadableCount: number }> {
  const results = await Promise.allSettled(readers.map(async (read) => read()));
  const drafts = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  return {
    drafts: drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    unreadableCount: results.length - drafts.length,
  };
}
