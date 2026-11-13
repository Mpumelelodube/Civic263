import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CommunityHistory } from '../components/community-history';
import {
  HANDOFF_LABELS,
  workflowLabel,
  categoryLabel,
  type PublicIncident,
} from '@civic263/domain';
import {
  evidenceAge,
  publicPhotoUrl,
  publicResolutionPhotoUrl,
  readPublicIncident,
  usePublicRegister,
} from '../lib/public-register';

export function IncidentDetailPage() {
  const { reference } = useParams();
  const { asOf } = usePublicRegister();
  const [incident, setIncident] = useState<PublicIncident | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    setIncident((current) => (current?.id === reference ? current : null));
    setError(null);
    const timeout = setTimeout(() => abort.abort(), 20000);
    void readPublicIncident(reference ?? '', abort.signal)
      .then((item) => {
        if (active) setIncident(item);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error && reason.name !== 'AbortError'
              ? reason.message
              : 'Could not load this issue. Please retry.',
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      abort.abort();
    };
  }, [reference, version, asOf]);
  return (
    <>
      <Link className="text-link" to="/">
        Back to register
      </Link>
      <section className="panel content-panel">
        <h1>{incident?.title ?? (error ? 'Issue unavailable' : 'Loading published issue...')}</h1>
        {error && (
          <p role="alert">
            {error} <button onClick={() => setVersion((current) => current + 1)}>Retry</button>
          </p>
        )}
        {incident && (
          <>
            <p className="muted">
              {incident.reference} / {incident.area} / {categoryLabel(incident.categoryId)}
            </p>
            <div className="evidence-strip">
              <span>{workflowLabel(incident)}</span>
              <span>{HANDOFF_LABELS[incident.handoffStatus]}</span>
            </div>
            <p>{incident.summary}</p>
            {incident.communityResolution && (
              <p className="muted">
                {incident.communityResolution.status === 'awaiting-confirmation'
                  ? 'A resident reported a fix. It remains on the active map while a different community reviewer checks the site.'
                  : incident.communityResolution.status === 'confirmed'
                    ? 'A different resident confirmed the repair on site. The issue remains in this archive.'
                    : 'A community reviewer found the issue is still broken. It remains active.'}
              </p>
            )}
            <div className="report-gallery">
              {Array.from({ length: incident.photoCount ?? 0 }, (_, index) => (
                <a
                  key={index}
                  href={publicPhotoUrl(incident.id, index)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={publicPhotoUrl(incident.id, index)}
                    alt={`Approved report photo ${index + 1}`}
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
            {incident.resolution && (
              <>
                <h2>Resolution photos</h2>
                <p className="muted small">
                  {incident.resolution.evidenceStatus === 'pending'
                    ? 'Awaiting automatic privacy checks.'
                    : incident.resolution.photoCount
                      ? 'New photos submitted by the reporter and cleared for public viewing.'
                      : 'No resolution photos cleared for public viewing.'}
                </p>
                <div className="report-gallery">
                  {Array.from({ length: incident.resolution.photoCount ?? 0 }, (_, index) => (
                    <a
                      key={index}
                      href={publicResolutionPhotoUrl(incident.id, index)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={publicResolutionPhotoUrl(incident.id, index)}
                        alt={`Reporter resolution photo ${index + 1}`}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </>
            )}
            <h2>Public evidence history</h2>
            <ol className="history">
              {incident.communityResolution && (
                <li>
                  Fix reported:{' '}
                  {new Date(incident.communityResolution.reportedFixedAt).toLocaleString()}.
                  {incident.communityResolution.reviewedAt
                    ? ` Community review: ${new Date(incident.communityResolution.reviewedAt).toLocaleString()}.`
                    : ' Awaiting community confirmation.'}
                </li>
              )}
              {incident.resolution && (
                <li>
                  Resolved by reporter: {new Date(incident.resolution.resolvedAt).toLocaleString()}.
                  Recorded from the reporter's observation.
                </li>
              )}
              <li>Published after automatic checks: {evidenceAge(incident.firstAcceptedAt)}.</li>
              <li>
                Latest approved resident observation: {evidenceAge(incident.lastApprovedEvidenceAt)}
                .
              </li>
              <li>Handoff: {HANDOFF_LABELS[incident.handoffStatus]}.</li>
            </ol>
            <CommunityHistory
              key={`${incident.id}-${asOf}`}
              reportId={incident.id}
              version={version}
            />
            <p className="muted small">
              Automated checks can make mistakes. Publication is not a field inspection. Reporter
              identity and original private uploads are excluded. Public positions are approximate.
            </p>
          </>
        )}
      </section>
    </>
  );
}
