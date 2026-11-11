import { Link, useParams } from 'react-router-dom';
import { HANDOFF_LABELS, WORKFLOW_LABELS, categoryLabel } from '@civic263/domain';
import { DEMO_INCIDENTS, ageInDays } from '../data/demo-incidents';

export function IncidentDetailPage() {
  const { reference } = useParams();
  const incident = DEMO_INCIDENTS.find((item) => item.reference === reference);
  if (!incident)
    return (
      <section className="panel content-panel">
        <h1>Issue not found</h1>
        <p>The reference does not match a published demonstration record.</p>
        <Link className="text-link" to="/">
          Return to the register
        </Link>
      </section>
    );
  return (
    <>
      <Link className="text-link" to="/">
        Back to register
      </Link>
      <section className="panel content-panel">
        <h1>{incident.title}</h1>
        <p className="muted">
          {incident.reference} / {incident.area} / {categoryLabel(incident.categoryId)}
        </p>
        <div className="evidence-strip">
          <span>{WORKFLOW_LABELS[incident.workflowStatus]}</span>
          <span>{HANDOFF_LABELS[incident.handoffStatus]}</span>
        </div>
        <p>{incident.summary}</p>
        <h2>Public evidence history</h2>
        <ol className="history">
          <li>First accepted observation: {ageInDays(incident.firstAcceptedAt)}.</li>
          <li>Latest reviewed observation: {ageInDays(incident.lastApprovedEvidenceAt)}.</li>
          <li>
            Handoff: {HANDOFF_LABELS[incident.handoffStatus]}. This is fictional, not a real
            authority response.
          </li>
        </ol>
        <p className="muted small">
          Publication review does not imply a field inspection. Reporter identity and original
          private uploads are excluded.
        </p>
      </section>
    </>
  );
}
