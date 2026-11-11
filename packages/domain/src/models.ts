import type { CategoryId } from './categories.ts';

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type WorkflowStatus =
  | 'received'
  | 'acknowledged'
  | 'assigned'
  | 'in-progress'
  | 'resolved'
  | 'closed'
  | 'out-of-scope'
  | 'merged';
export type HandoffStatus = 'not-sent' | 'sent' | 'acknowledged' | 'failed';
export type EvidenceSource = 'resident-observation' | 'authority-statement' | 'field-check';
export type IssueLocation = { latitude: number; longitude: number };

export interface ReportDraft {
  id: string;
  categoryId: CategoryId;
  description: string;
  landmark: string;
  createdAt: string;
  updatedAt: string;
  state: 'draft';
}

export interface PublicIncident {
  id: string;
  reference: string;
  municipalityId: string;
  title: string;
  summary: string;
  categoryId: CategoryId;
  area: string;
  workflowStatus: WorkflowStatus;
  handoffStatus: HandoffStatus;
  firstAcceptedAt: string;
  lastApprovedEvidenceAt: string | null;
  evidenceSource: EvidenceSource;
  location: IssueLocation | null;
  locationPrecision: 'exact' | 'approximate' | 'hidden';
  publicationVersion: number;
}

export interface IncidentRecord extends PublicIncident {
  publicationStatus: 'hidden' | 'published';
  internalNotes: string;
  rawMediaPaths: string[];
}

export interface PublicIncidentResponse {
  incidents: PublicIncident[];
  asOf: string;
  truncated: boolean;
  nextCursor: string | null;
}

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  received: 'Received',
  acknowledged: 'Acknowledged by platform',
  assigned: 'Assigned',
  'in-progress': 'In progress',
  resolved: 'Resolution recorded',
  closed: 'Closed',
  'out-of-scope': 'Outside service scope',
  merged: 'Linked to another issue',
};
export const HANDOFF_LABELS: Record<HandoffStatus, string> = {
  'not-sent': 'Not yet sent to responsible service',
  sent: 'Sent; acknowledgement pending',
  acknowledged: 'Acknowledged by responsible service',
  failed: 'Handoff needs attention',
};
export function isOpenIncident(incident: Pick<PublicIncident, 'workflowStatus'>): boolean {
  return !['resolved', 'closed', 'out-of-scope', 'merged'].includes(incident.workflowStatus);
}
