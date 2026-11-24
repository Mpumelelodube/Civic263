import type { ReportDraft, ResidentReport } from '@civic263/domain';

export type ReportHistoryRow =
  { kind: 'cloud'; item: ResidentReport } | { kind: 'draft'; item: ReportDraft };

export function mergeResidentReports(current: ResidentReport[], incoming: ResidentReport[]) {
  return [...new Map([...current, ...incoming].map((item) => [item.id, item])).values()];
}

export function reportHistoryRows(drafts: ReportDraft[], reports: ResidentReport[]) {
  const receivedIds = new Set(reports.map((item) => item.id));
  const rows: ReportHistoryRow[] = [
    ...drafts
      .filter((item) => !item.receipt || !receivedIds.has(item.receipt.reportId))
      .map((item) => ({ kind: 'draft' as const, item })),
    ...reports.map((item) => ({ kind: 'cloud' as const, item })),
  ];
  const timestamp = (row: ReportHistoryRow) =>
    row.kind === 'cloud'
      ? row.item.createdAt
      : (row.item.receipt?.receivedAt ?? row.item.updatedAt);
  return rows.sort((left, right) => Date.parse(timestamp(right)) - Date.parse(timestamp(left)));
}

export type ReportGroup = 'drafts' | 'submitted' | 'resolved';
/** Which status filter a row belongs to in My reports. */
export function reportGroup(row: ReportHistoryRow): ReportGroup {
  if (row.kind === 'draft') return row.item.receipt ? 'submitted' : 'drafts';
  return row.item.workflowStatus === 'resolved' ? 'resolved' : 'submitted';
}
export function countReportGroups(rows: ReportHistoryRow[]) {
  const counts: Record<ReportGroup | 'all', number> = {
    all: rows.length,
    drafts: 0,
    submitted: 0,
    resolved: 0,
  };
  for (const row of rows) counts[reportGroup(row)] += 1;
  return counts;
}
