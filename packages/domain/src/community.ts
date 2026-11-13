import type { WorkflowStatus } from './models.ts';
import { parseResolutionCommand, type ResolutionCommand } from './report-resolution.ts';

export const COMMUNITY_ID = /^[a-f0-9]{40}$/;
export type FieldCheckKind = 'report-fix' | 'confirm-fix' | 'reject-fix';
export type EvidenceStatus = 'pending' | 'published' | 'private';
export interface CommunityResolution {
  status: 'awaiting-confirmation' | 'confirmed' | 'not-fixed';
  fixId: string;
  reportedFixedAt: string;
  reviewedAt?: string;
}
export type CommunityCheckCommand = Omit<ResolutionCommand, 'action'> & {
  action: FieldCheckKind;
  fixId?: string;
};
export interface CommunityReceipt {
  reportId: string;
  checkId: string;
  workflowStatus: WorkflowStatus;
  communityResolution: CommunityResolution;
}
export interface PublicFieldCheck {
  id: string;
  kind: FieldCheckKind;
  createdAt: string;
  evidenceStatus: EvidenceStatus;
  photoCount: number;
}
export interface CommunityPreferences {
  reviewer: boolean;
  nearbyAlerts: boolean;
  backgroundAlerts: boolean;
  pushUpdates: boolean;
}
export const DEFAULT_COMMUNITY_PREFERENCES: CommunityPreferences = {
  reviewer: false,
  nearbyAlerts: false,
  backgroundAlerts: false,
  pushUpdates: false,
};
export interface ResidentNotification {
  id: string;
  reportId: string;
  reference: string;
  kind: FieldCheckKind;
  createdAt: string;
  readAt: string | null;
}
export interface CommunityContext {
  onSite: boolean;
  hasSite: boolean;
  canReportFix: boolean;
  canReview: boolean;
  ownProposal: boolean;
  reviewer: boolean;
  communityResolution: CommunityResolution | null;
}
export interface CommunityVisit extends PublicFieldCheck {
  reportId: string;
  reference: string;
  ownPhotoCount: number;
}
export const FIELD_CHECK_LABELS: Record<FieldCheckKind, string> = {
  'report-fix': 'Fix reported',
  'confirm-fix': 'Confirmed fixed',
  'reject-fix': 'Still broken',
};
export function readCommunityResolution(value: unknown): CommunityResolution | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (
    !['awaiting-confirmation', 'confirmed', 'not-fixed'].includes(String(data.status)) ||
    typeof data.fixId !== 'string' ||
    !COMMUNITY_ID.test(data.fixId) ||
    typeof data.reportedFixedAt !== 'string' ||
    !Number.isFinite(Date.parse(data.reportedFixedAt)) ||
    (data.reviewedAt !== undefined &&
      (typeof data.reviewedAt !== 'string' || !Number.isFinite(Date.parse(data.reviewedAt))))
  )
    return null;
  return {
    status: data.status as CommunityResolution['status'],
    fixId: data.fixId,
    reportedFixedAt: data.reportedFixedAt,
    ...(typeof data.reviewedAt === 'string' ? { reviewedAt: data.reviewedAt } : {}),
  };
}
export function parseCommunityCheck(value: unknown): CommunityCheckCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid field check.');
  const { action, fixId, ...rest } = value as Record<string, unknown>;
  const kind = action === 'resolve' ? 'report-fix' : action;
  if (
    !['report-fix', 'confirm-fix', 'reject-fix'].includes(String(kind)) ||
    (kind === 'report-fix'
      ? fixId !== undefined
      : typeof fixId !== 'string' || !COMMUNITY_ID.test(fixId))
  )
    throw new Error('Choose the current fix to review.');
  const parsed = parseResolutionCommand({ ...rest, action: 'resolve' });
  return {
    ...parsed,
    action: kind as FieldCheckKind,
    ...(typeof fixId === 'string' ? { fixId } : {}),
  };
}
export function parseCommunityPreferences(value: unknown): CommunityPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid review preferences.');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).length !== 4 ||
    Object.keys(data).some(
      (key) => !Object.hasOwn(DEFAULT_COMMUNITY_PREFERENCES, key) || typeof data[key] !== 'boolean',
    ) ||
    (data.backgroundAlerts && !data.nearbyAlerts)
  )
    throw new Error('Choose valid review and reminder preferences.');
  return {
    reviewer: data.reviewer as boolean,
    nearbyAlerts: data.nearbyAlerts as boolean,
    backgroundAlerts: data.backgroundAlerts as boolean,
    pushUpdates: data.pushUpdates as boolean,
  };
}
export function checkCommunityTransition(input: {
  action: FieldCheckKind;
  workflowStatus: WorkflowStatus;
  current?: CommunityResolution | null;
  actorUid: string;
  proposerUid?: string;
  reviewer: boolean;
  fixId?: string;
}) {
  if (input.action === 'report-fix') {
    if (
      ['resolved', 'closed', 'merged', 'out-of-scope', 'resolution-pending'].includes(
        input.workflowStatus,
      )
    )
      throw new Error('This issue is no longer accepting a fix report. Refresh its status.');
  } else {
    if (!input.reviewer) throw new Error('Opt into community reviewing before confirming a fix.');
    if (input.actorUid === input.proposerUid)
      throw new Error('A different resident must review this fix.');
    if (
      input.workflowStatus !== 'resolution-pending' ||
      input.current?.status !== 'awaiting-confirmation' ||
      input.fixId !== input.current.fixId
    )
      throw new Error('This fix has already changed. Refresh before reviewing.');
  }
}
