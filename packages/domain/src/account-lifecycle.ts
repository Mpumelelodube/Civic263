import { isCategoryId, type CategoryId } from './categories.ts';
import { validateDraft } from './validation.ts';
import { parseReportLocation, type ReportLocation } from './locations.ts';
import { PHOTO_LIMITS } from './report-submission.ts';
import type { ModerationStatus, WorkflowStatus } from './models.ts';

// Replaces a deleted resident's UID wherever a non-identifying actor is still needed.
export const ERASED_RESIDENT = 'erased-resident';
export const MAX_REPORT_CORRECTIONS = 3;
export const WITHDRAWN_SUMMARY =
  'The resident who sent this report withdrew it, so its description and photos were removed. Community checks recorded for this issue remain.';

export type WithdrawalOutcome = 'private' | 'unpublished' | 'retained';
export interface WithdrawalReceipt {
  reportId: string;
  outcome: WithdrawalOutcome;
  withdrawnAt: string;
}
export interface CorrectionReceipt {
  reportId: string;
  revision: number;
}
export interface AccountDeletionResult {
  status: 'partial' | 'complete';
}

const REPORT_ID = /^[a-f0-9]{40}$/u;
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: unknown, keys: string[]): Record<string, unknown> {
  if (!record(value) || Object.keys(value).some((key) => !['action', ...keys].includes(key)))
    throw new Error('The request contains unsupported fields.');
  return value;
}
function reportId(value: unknown) {
  if (typeof value !== 'string' || !REPORT_ID.test(value))
    throw new Error('Choose a valid report.');
  return value;
}

// Others' independent site evidence is what keeps a withdrawn public issue on the register.
export function withdrawalOutcome(input: {
  published: boolean;
  otherEvidence: boolean;
}): WithdrawalOutcome {
  if (!input.published) return 'private';
  return input.otherEvidence ? 'retained' : 'unpublished';
}

export function canWithdrawReport(report: { moderationStatus: ModerationStatus }) {
  return report.moderationStatus !== 'withdrawn';
}

export function canCorrectReport(report: {
  moderationStatus: ModerationStatus;
  publicationStatus: string;
  workflowStatus: WorkflowStatus;
  reviewStatus: string;
  correctionCount?: number;
}) {
  return (
    report.moderationStatus === 'pending' &&
    report.publicationStatus === 'hidden' &&
    report.workflowStatus === 'received' &&
    ['queued', 'retrying', 'held'].includes(report.reviewStatus) &&
    (report.correctionCount ?? 0) < MAX_REPORT_CORRECTIONS
  );
}

export function parseWithdrawal(value: unknown) {
  const data = exactKeys(value, ['reportId']);
  return { reportId: reportId(data.reportId) };
}

export interface ReportCorrectionInput {
  reportId: string;
  revision: number;
  categoryId: CategoryId;
  description: string;
  landmark: string;
  location: ReportLocation;
  keepPhotos: number[];
}
export function parseReportCorrection(value: unknown): ReportCorrectionInput {
  const data = exactKeys(value, [
    'reportId',
    'revision',
    'categoryId',
    'description',
    'landmark',
    'location',
    'keepPhotos',
  ]);
  const id = reportId(data.reportId);
  if (typeof data.revision !== 'number' || !Number.isInteger(data.revision) || data.revision < 0)
    throw new Error('Refresh this report before correcting it.');
  if (
    !isCategoryId(data.categoryId) ||
    typeof data.description !== 'string' ||
    typeof data.landmark !== 'string'
  )
    throw new Error('Choose a service and add the report details.');
  const errors = validateDraft({
    categoryId: data.categoryId,
    description: data.description,
    landmark: data.landmark,
  });
  if (errors.length) throw new Error(errors.join(' '));
  if (data.location === undefined) throw new Error('Confirm a report pin before sending.');
  const keep = data.keepPhotos;
  if (
    !Array.isArray(keep) ||
    keep.length > PHOTO_LIMITS.maximum ||
    keep.some((index) => !Number.isInteger(index) || index < 0 || index >= PHOTO_LIMITS.maximum) ||
    new Set(keep).size !== keep.length
  )
    throw new Error('Choose which existing photos to keep.');
  return {
    reportId: id,
    revision: data.revision,
    categoryId: data.categoryId,
    description: data.description.trim(),
    landmark: data.landmark.trim(),
    location: parseReportLocation(data.location),
    keepPhotos: [...(keep as number[])].sort((a, b) => a - b),
  };
}

export function parseAccountDeletion(value: unknown) {
  const data = exactKeys(value, ['confirm']);
  if (data.confirm !== 'DELETE') throw new Error('Confirm account deletion to continue.');
  return { confirm: 'DELETE' as const };
}
