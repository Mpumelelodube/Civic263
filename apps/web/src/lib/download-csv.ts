import { DATA_LICENCE, csvCell, type PublicIncident } from '@civic263/domain';

export function downloadPublicCsv(incidents: PublicIncident[], asOf: string): void {
  const columns = [
    'dataset',
    'reference',
    'title',
    'category',
    'area',
    'workflow',
    'handoff',
    'first_accepted_at',
    'last_evidence_at',
    'resolution_source',
    'resolved_at',
    'community_status',
    'fix_reported_at',
    'community_reviewed_at',
    'as_of',
    // A downloaded file keeps its reuse terms even when separated from the site.
    'licence',
    'attribution',
  ];
  const rows = incidents.map((item) => [
    'Civic263 public resident observations',
    item.reference,
    item.title,
    item.categoryId,
    item.area,
    item.workflowStatus,
    item.handoffStatus,
    item.firstAcceptedAt,
    item.lastApprovedEvidenceAt,
    item.resolution?.source ?? '',
    item.resolution?.resolvedAt ?? '',
    item.communityResolution?.status ?? '',
    item.communityResolution?.reportedFixedAt ?? '',
    item.communityResolution?.reviewedAt ?? '',
    asOf,
    `${DATA_LICENCE.id} ${DATA_LICENCE.url}`,
    DATA_LICENCE.attribution,
  ]);
  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'Civic263_public_records.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
