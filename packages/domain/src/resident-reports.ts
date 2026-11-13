import type { CategoryId } from './categories.ts';
import type { ModerationStatus, WorkflowStatus } from './models.ts';
import type { ReportLocation } from './locations.ts';
import type { ReportResolution } from './report-resolution.ts';
import type { CommunityResolution } from './community.ts';

export type ReviewStatus = 'queued' | 'processing' | 'retrying' | 'published' | 'held';
export type ReviewReason =
  'privacy' | 'unsafe' | 'uncertain' | 'irrelevant' | 'unavailable' | 'resolved';
export interface ResidentReport {
  id: string;
  reference: string;
  categoryId: CategoryId;
  description: string;
  landmark: string;
  createdAt: string;
  moderationStatus: ModerationStatus;
  publicationStatus: 'hidden' | 'published';
  workflowStatus: WorkflowStatus;
  reviewStatus: ReviewStatus;
  reviewReason: ReviewReason | null;
  photoCount: number;
  testOnly: boolean;
  incidentReference: string | null;
  resolution?: ReportResolution;
  communityResolution?: CommunityResolution;
}
export interface ResidentReportDetail extends ResidentReport {
  location: ReportLocation | null;
  photos: { base64: string }[];
  resolutionPhotos?: { base64: string }[];
}
export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  queued: 'Waiting for automatic review',
  processing: 'Checking text and photos',
  retrying: 'Review will retry',
  published: 'Published to the public register',
  held: 'Kept private after automatic review',
};
export const REVIEW_REASONS: Record<ReviewReason, string> = {
  resolved: 'You marked this report resolved before publication.',
  privacy: 'Personal information needs a closer review.',
  unsafe: 'The content could not be cleared for public viewing.',
  uncertain: 'The automatic check could not confidently confirm a service issue.',
  irrelevant: 'The content could not be matched to a municipal service issue.',
  unavailable: 'Automatic review could not finish. Your report is safely stored.',
};
