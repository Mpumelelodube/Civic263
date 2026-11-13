import type { IncidentRecord, PublicIncident } from './models.ts';
import { readResolution } from './report-resolution.ts';
import { readCommunityResolution } from './community.ts';

export function toPublicIncident(record: IncidentRecord): PublicIncident | null {
  if (record.publicationStatus !== 'published' || record.workflowStatus === 'merged') return null;
  const resolution = readResolution(record.resolution);
  const communityResolution = readCommunityResolution(record.communityResolution);
  // Copy each public field explicitly. Object spreading the private record is forbidden here.
  return {
    id: record.id,
    reference: record.reference,
    municipalityId: record.municipalityId,
    title: record.title,
    summary: record.summary,
    categoryId: record.categoryId,
    area: record.area,
    workflowStatus: record.workflowStatus,
    handoffStatus: record.handoffStatus,
    firstAcceptedAt: record.firstAcceptedAt,
    lastApprovedEvidenceAt: record.lastApprovedEvidenceAt,
    evidenceSource: record.evidenceSource,
    location: record.locationPrecision === 'hidden' ? null : record.location,
    locationPrecision: record.locationPrecision,
    publicationVersion: record.publicationVersion,
    ...(record.photoCount !== undefined ? { photoCount: record.photoCount } : {}),
    ...(record.reviewMethod === 'automated' ? { reviewMethod: 'automated' as const } : {}),
    ...(resolution ? { resolution } : {}),
    ...(communityResolution ? { communityResolution } : {}),
  };
}
