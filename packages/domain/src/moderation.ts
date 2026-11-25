import type { ModerationStatus, WorkflowStatus } from './models.ts';

/** Distinct reporting identities that hide public content until an operator reviews it. */
export const AUTO_HIDE_REPORTERS = 3;
export const RESPONSE_TARGET_WORKING_DAYS = 2;
export const APPEAL_NOTE_MAX = 500;
export const COMPLAINT_NOTE_MAX = 300;
export const DECISION_NOTE_MAX = 500;
export const DAILY_COMPLAINT_LIMIT = 20;

const REPORT_ID = /^[a-f0-9]{40}$/u;
const BLOCK_ID = /^[a-f0-9]{64}$/u;

export type AppealStatus = 'open' | 'published' | 'kept-private';
export type KeepPrivateReason =
  'personal-information' | 'unsafe-content' | 'not-a-service-issue' | 'duplicate' | 'other';
export const KEEP_PRIVATE_LABELS: Record<KeepPrivateReason, string> = {
  'personal-information': 'It shows or describes personal information that cannot be removed.',
  'unsafe-content': 'It contains content that cannot be shown publicly.',
  'not-a-service-issue': 'It does not describe a municipal service issue.',
  duplicate: 'The same issue is already on the public register.',
  other: 'A reviewer decided to keep it private.',
};
export interface ResidentAppeal {
  status: AppealStatus;
  requestedAt: string;
  dueBy: string;
  decidedAt?: string;
  reason?: KeepPrivateReason;
  note?: string;
}

export type ComplaintReason =
  'personal-information' | 'offensive' | 'unsafe' | 'false-or-spam' | 'other';
export const COMPLAINT_REASONS: Record<ComplaintReason, string> = {
  'personal-information': 'Shows a person, number plate, home or other personal information',
  offensive: 'Offensive or abusive',
  unsafe: 'Dangerous or encourages unsafe behaviour',
  'false-or-spam': 'False, misleading or spam',
  other: 'Something else',
};
export type ComplaintTarget =
  | { type: 'issue'; reportId: string }
  | { type: 'photo'; reportId: string; index: number }
  | { type: 'check'; reportId: string; checkId: string };
export type FlagStatus = 'visible' | 'auto-hidden' | 'restored' | 'removed';
export type ComplaintPriority = 'high' | 'normal';

/** Public, non-personal label for content an operator is reviewing or removed. */
export type ModerationHold = { status: 'hidden' | 'removed'; since: string };

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: unknown, keys: string[], optional: string[] = []) {
  if (
    !record(value) ||
    Object.keys(value).some((key) => !['action', ...keys, ...optional].includes(key)) ||
    keys.some((key) => value[key] === undefined)
  )
    throw new Error('The request contains unsupported or missing fields.');
  return value;
}
function reportId(value: unknown) {
  if (typeof value !== 'string' || !REPORT_ID.test(value))
    throw new Error('Choose a valid report.');
  return value;
}
function note(value: unknown, max: number) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim().length > max)
    throw new Error(`Keep the note to ${max} characters.`);
  return value.trim() || undefined;
}

export const containsContactDetails = (text: string) =>
  /(?:https?:|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s()-]*){7,}|@[a-z0-9_]+)/i.test(text);

/** Adds working days (Monday to Friday, UTC). Public holidays are not modelled. */
export function addWorkingDays(from: Date, days: number) {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date;
}

export function canRequestReview(report: {
  moderationStatus: ModerationStatus;
  publicationStatus: string;
  workflowStatus: WorkflowStatus;
  reviewStatus: string;
  appeal?: { status: AppealStatus } | null;
  testOnly?: boolean;
}) {
  return (
    report.moderationStatus === 'pending' &&
    report.publicationStatus === 'hidden' &&
    report.workflowStatus === 'received' &&
    report.reviewStatus === 'held' &&
    !report.appeal &&
    report.testOnly !== true
  );
}

export function parseReviewRequest(value: unknown) {
  const data = exactKeys(value, ['reportId'], ['note']);
  const text = note(data.note, APPEAL_NOTE_MAX);
  return { reportId: reportId(data.reportId), ...(text ? { note: text } : {}) };
}

export function parseComplaint(value: unknown): {
  target: ComplaintTarget;
  reason: ComplaintReason;
  note?: string;
} {
  const data = exactKeys(value, ['target', 'reason'], ['note']);
  if (typeof data.reason !== 'string' || !Object.hasOwn(COMPLAINT_REASONS, data.reason))
    throw new Error('Choose why you are reporting this.');
  const target = data.target;
  if (!record(target)) throw new Error('Choose what you are reporting.');
  let parsed: ComplaintTarget;
  if (target.type === 'issue' && Object.keys(target).length === 2)
    parsed = { type: 'issue', reportId: reportId(target.reportId) };
  else if (
    target.type === 'photo' &&
    Object.keys(target).length === 3 &&
    Number.isInteger(target.index) &&
    (target.index as number) >= 0 &&
    (target.index as number) < 6
  )
    parsed = { type: 'photo', reportId: reportId(target.reportId), index: target.index as number };
  else if (
    target.type === 'check' &&
    Object.keys(target).length === 3 &&
    typeof target.checkId === 'string' &&
    REPORT_ID.test(target.checkId)
  )
    parsed = { type: 'check', reportId: reportId(target.reportId), checkId: target.checkId };
  else throw new Error('Choose what you are reporting.');
  const text = note(data.note, COMPLAINT_NOTE_MAX);
  return {
    target: parsed,
    reason: data.reason as ComplaintReason,
    ...(text ? { note: text } : {}),
  };
}

/** Stable key for one public item. Photos use their stored index, which never renumbers. */
export function flagKey(target: ComplaintTarget, storedIndex?: number) {
  if (target.type === 'issue') return target.reportId;
  if (target.type === 'photo') return `${target.reportId}_photo_${storedIndex ?? target.index}`;
  return `${target.reportId}_check_${target.checkId}`;
}

export function complaintPriority(reasons: Partial<Record<ComplaintReason, number>>) {
  return (reasons['personal-information'] ?? 0) > 0 || (reasons.unsafe ?? 0) > 0
    ? ('high' as const)
    : ('normal' as const);
}

export function shouldAutoHide(input: { status: FlagStatus; reporters: number; baseline: number }) {
  return (
    (input.status === 'visible' || input.status === 'restored') &&
    input.reporters - input.baseline >= AUTO_HIDE_REPORTERS
  );
}

export interface StaffPublication {
  title: string;
  summary: string;
  area: string;
}
/** Operator-written public text follows the same limits as automated summaries. */
export function parsePublicText(value: Record<string, unknown>): StaffPublication {
  const limits = [
    ['title', 5, 120],
    ['summary', 10, 600],
    ['area', 2, 100],
  ] as const;
  for (const [field, min, max] of limits) {
    const text = value[field];
    if (typeof text !== 'string' || text.trim().length < min || text.trim().length > max)
      throw new Error(`Write a public ${field} of ${min} to ${max} characters.`);
  }
  const result = {
    title: String(value.title).trim(),
    summary: String(value.summary).trim(),
    area: String(value.area).trim(),
  };
  if (containsContactDetails(`${result.title} ${result.summary} ${result.area}`))
    throw new Error('Remove contact details, links and handles from the public text.');
  return result;
}

export type StaffCommand =
  | { action: 'staff-profile' }
  | { action: 'staff-queue'; queue: 'appeals' | 'complaints' | 'held' | 'blocks' }
  | { action: 'staff-report'; reportId: string }
  | ({ action: 'staff-publish'; reportId: string; photos: number[] } & StaffPublication)
  | { action: 'staff-keep-private'; reportId: string; reason: KeepPrivateReason; note?: string }
  | { action: 'staff-resolve-complaint'; key: string; outcome: 'restore' | 'remove'; note?: string }
  | { action: 'staff-block'; reportId: string; checkId?: string; note: string }
  | { action: 'staff-unblock'; blockId: string; note: string };

export function parseStaffCommand(value: unknown): StaffCommand {
  const action = record(value) ? value.action : undefined;
  if (action === 'staff-profile') {
    exactKeys(value, []);
    return { action };
  }
  if (action === 'staff-queue') {
    const data = exactKeys(value, ['queue']);
    if (!['appeals', 'complaints', 'held', 'blocks'].includes(String(data.queue)))
      throw new Error('Choose a review queue.');
    return { action, queue: data.queue as 'appeals' };
  }
  if (action === 'staff-report') {
    const data = exactKeys(value, ['reportId']);
    return { action, reportId: reportId(data.reportId) };
  }
  if (action === 'staff-publish') {
    const data = exactKeys(value, ['reportId', 'title', 'summary', 'area', 'photos']);
    const photos = data.photos;
    if (
      !Array.isArray(photos) ||
      photos.length > 3 ||
      photos.some((index) => !Number.isInteger(index) || index < 0 || index > 2) ||
      new Set(photos).size !== photos.length
    )
      throw new Error('Choose which photos to publish.');
    return {
      action,
      reportId: reportId(data.reportId),
      photos: [...(photos as number[])].sort((a, b) => a - b),
      ...parsePublicText(data),
    };
  }
  if (action === 'staff-keep-private') {
    const data = exactKeys(value, ['reportId', 'reason'], ['note']);
    if (typeof data.reason !== 'string' || !Object.hasOwn(KEEP_PRIVATE_LABELS, data.reason))
      throw new Error('Choose a reason the resident will see.');
    const text = note(data.note, DECISION_NOTE_MAX);
    return {
      action,
      reportId: reportId(data.reportId),
      reason: data.reason as KeepPrivateReason,
      ...(text ? { note: text } : {}),
    };
  }
  if (action === 'staff-resolve-complaint') {
    const data = exactKeys(value, ['key', 'outcome'], ['note']);
    if (
      typeof data.key !== 'string' ||
      !/^[a-f0-9]{40}(?:_photo_[0-5]|_check_[a-f0-9]{40})?$/u.test(data.key) ||
      !['restore', 'remove'].includes(String(data.outcome))
    )
      throw new Error('Choose a complaint and an outcome.');
    const text = note(data.note, DECISION_NOTE_MAX);
    return {
      action,
      key: data.key,
      outcome: data.outcome as 'restore',
      ...(text ? { note: text } : {}),
    };
  }
  if (action === 'staff-block' || action === 'staff-unblock') {
    const data =
      action === 'staff-block'
        ? exactKeys(value, ['reportId', 'note'], ['checkId'])
        : exactKeys(value, ['blockId', 'note']);
    const text = note(data.note, DECISION_NOTE_MAX);
    if (!text) throw new Error('Record why, for the audit trail.');
    if (action === 'staff-unblock') {
      if (typeof data.blockId !== 'string' || !BLOCK_ID.test(data.blockId))
        throw new Error('Choose a blocked identity.');
      return { action, blockId: data.blockId, note: text };
    }
    if (
      data.checkId !== undefined &&
      (typeof data.checkId !== 'string' || !REPORT_ID.test(data.checkId))
    )
      throw new Error('Choose a valid community check.');
    return {
      action,
      reportId: reportId(data.reportId),
      ...(typeof data.checkId === 'string' ? { checkId: data.checkId } : {}),
      note: text,
    };
  }
  throw new Error('Unknown staff command.');
}
