import { csvCell, type PublicIncident } from '@civic263/domain';

export function downloadDemoCsv(incidents: PublicIncident[], asOf: string): void {
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
    'as_of',
  ];
  const rows = incidents.map((item) => [
    'FICTIONAL DEMO DATA',
    item.reference,
    item.title,
    item.categoryId,
    item.area,
    item.workflowStatus,
    item.handoffStatus,
    item.firstAcceptedAt,
    item.lastApprovedEvidenceAt,
    asOf,
  ]);
  const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'Civic263_FICTIONAL_demo.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
