import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  KEEP_PRIVATE_LABELS,
  REVIEW_REASONS,
  categoryLabel,
  type CategoryId,
  type KeepPrivateReason,
  type ReviewReason,
} from '@civic263/domain';
import { staffCall, staffError } from '../lib/firebase';
import { Due, formatDate } from './queues';

type Flag = {
  key: string;
  target: { type: 'issue' | 'photo' | 'check'; storedIndex?: number; checkId?: string };
  status: string;
  open: boolean;
  reporters: number;
  baseline: number;
  priority: 'high' | 'normal';
  dueBy: string;
};
type StaffReport = {
  reportId: string;
  reference: string;
  categoryId: CategoryId;
  description: string;
  landmark: string;
  location: { latitude: number; longitude: number } | null;
  createdAt: string;
  moderationStatus: string;
  publicationStatus: string;
  reviewStatus: string;
  reviewReason: ReviewReason | null;
  withdrawn: boolean;
  ownerErased: boolean;
  originals: (string | null)[];
  appeal: { status: string; requestedAt: string; dueBy: string; note?: string } | null;
  published: {
    title: string;
    summary: string;
    area: string;
    reviewMethod: string;
    moderationHold: { status: string } | null;
    photos: { storedIndex: number; hidden: boolean; removed: boolean; base64: string | null }[];
  } | null;
  flags: Flag[];
  complaints: { key: string; reasonLabel: string; note: string | null; createdAt: string }[];
  checks: { checkId: string; kind: string; createdAt: string; photos: (string | null)[] }[];
};
const image = (base64: string | null) => (base64 ? `data:image/jpeg;base64,${base64}` : null);

function Photo({ base64, label, note }: { base64: string | null; label: string; note?: string }) {
  const src = image(base64);
  return (
    <figure className="review-photo">
      {src ? <img src={src} alt={label} /> : <div className="photo-missing">Unavailable</div>}
      <figcaption>
        {label}
        {note ? ` · ${note}` : ''}
      </figcaption>
    </figure>
  );
}

export function ReportReview() {
  const { reportId = '' } = useParams();
  const [report, setReport] = useState<StaffReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [area, setArea] = useState('');
  const [photos, setPhotos] = useState<number[]>([]);
  const [reason, setReason] = useState<KeepPrivateReason>('not-a-service-issue');
  const [note, setNote] = useState('');
  const load = useCallback(() => {
    setError(null);
    staffCall<StaffReport>('staff-report', { reportId })
      .then((result) => {
        setReport(result);
        setTitle(`${categoryLabel(result.categoryId)} issue`);
        setArea(result.landmark.slice(0, 100));
      })
      .catch((reasonError: unknown) => setError(staffError(reasonError)));
  }, [reportId]);
  useEffect(load, [load]);
  async function act(action: string, data: Record<string, unknown>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await staffCall(action, { ...data });
      setMessage(done);
      load();
    } catch (reasonError) {
      setMessage(staffError(reasonError));
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <p role="alert" className="form-message">
        {error} <Link to="/appeals">Back to appeals</Link>
      </p>
    );
  if (!report) return <p className="muted">Loading report…</p>;
  const held =
    report.reviewStatus === 'held' &&
    report.publicationStatus === 'hidden' &&
    report.moderationStatus === 'pending';
  const openAppeal = report.appeal?.status === 'open';
  const openFlags = report.flags.filter((flag) => flag.open);
  const publish = (event: FormEvent) => {
    event.preventDefault();
    if (
      !window.confirm(
        `Publish ${report.reference} with ${photos.length} photo(s) and your text? It appears on the public register immediately.`,
      )
    )
      return;
    void act(
      'staff-publish',
      { reportId, title, summary, area, photos },
      'Published. The resident sees that a reviewer published it.',
    );
  };
  const resolveFlag = (flag: Flag, outcome: 'restore' | 'remove') => {
    const verb = outcome === 'restore' ? 'Restore' : 'Permanently remove';
    const reason = window.prompt(`${verb} this content? Optional note for the audit trail:`, '');
    if (reason === null) return;
    void act(
      'staff-resolve-complaint',
      { key: flag.key, outcome, ...(reason.trim() ? { note: reason.trim() } : {}) },
      outcome === 'restore' ? 'Restored to public view.' : 'Removed from public view.',
    );
  };
  const block = (checkId?: string) => {
    const reason = window.prompt(
      `Block the ${checkId ? 'resident who made this visit' : 'reporter'}? They keep access to their own data but cannot add content. Reason (audited):`,
    );
    if (!reason?.trim()) return;
    void act(
      'staff-block',
      { reportId, ...(checkId ? { checkId } : {}), note: reason.trim() },
      'Identity blocked. Unblock it from Blocked identities.',
    );
  };
  return (
    <>
      <header className="page-header">
        <div>
          <p className="muted small">
            <Link to={openAppeal ? '/appeals' : openFlags.length ? '/complaints' : '/held'}>
              ← Back to queue
            </Link>
          </p>
          <h1>{report.reference}</h1>
          <p className="muted">
            {categoryLabel(report.categoryId)} · received {formatDate(report.createdAt)}
          </p>
        </div>
        <button type="button" onClick={load} disabled={busy}>
          Refresh
        </button>
      </header>
      {message && (
        <p role="status" className="form-message">
          {message}
        </p>
      )}
      {report.withdrawn && <p className="notice">The resident withdrew this report.</p>}
      {report.ownerErased && <p className="notice">The reporter deleted their account.</p>}
      <div className="review-grid">
        <section className="panel content-panel">
          <h2>What the resident submitted (private)</h2>
          <p>{report.description || <span className="muted">No description.</span>}</p>
          <p className="muted">{report.landmark}</p>
          {report.location && (
            <p className="small">
              Private pin {report.location.latitude.toFixed(5)},{' '}
              {report.location.longitude.toFixed(5)} ·{' '}
              <a
                href={`https://www.openstreetmap.org/?mlat=${report.location.latitude}&mlon=${report.location.longitude}#map=18/${report.location.latitude}/${report.location.longitude}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open map
              </a>
            </p>
          )}
          <p className="small muted">
            Automatic review: {report.reviewStatus}
            {report.reviewReason ? ` — ${REVIEW_REASONS[report.reviewReason]}` : ''}
          </p>
          <div className="photo-grid">
            {report.originals.map((base64, index) => (
              <Photo key={index} base64={base64} label={`Original ${index + 1}`} />
            ))}
          </div>
          {!report.originals.length && <p className="muted">No photos.</p>}
          {report.appeal && (
            <>
              <h2>Appeal</h2>
              <p>
                {report.appeal.status === 'open' ? 'Open' : report.appeal.status.replace('-', ' ')}{' '}
                · requested {formatDate(report.appeal.requestedAt)}{' '}
                {report.appeal.status === 'open' && <Due at={report.appeal.dueBy} />}
              </p>
              <p className="note-cell">
                {report.appeal.note ?? <span className="muted">No note from the resident.</span>}
              </p>
            </>
          )}
          {!report.ownerErased && !report.withdrawn && (
            <div className="actions">
              <button type="button" className="danger" disabled={busy} onClick={() => block()}>
                Block the reporter
              </button>
            </div>
          )}
        </section>
        <section className="panel content-panel">
          {held ? (
            <>
              <h2>Publish this report</h2>
              <p className="muted small">
                Write neutral public text. Leave out names, contact details, house numbers and
                anything that identifies a person. Choose only photos without faces, number plates
                or readable personal text.
              </p>
              <form className="form-grid" onSubmit={publish}>
                <label>
                  Public title
                  <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label>
                  Public summary
                  <textarea
                    rows={4}
                    value={summary}
                    maxLength={600}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </label>
                <label>
                  Public area
                  <input value={area} maxLength={100} onChange={(e) => setArea(e.target.value)} />
                </label>
                {report.originals.length > 0 && (
                  <fieldset>
                    <legend>Photos to publish</legend>
                    {report.originals.map((_, index) => (
                      <label key={index} className="check">
                        <input
                          type="checkbox"
                          checked={photos.includes(index)}
                          onChange={(e) =>
                            setPhotos((current) =>
                              e.target.checked
                                ? [...current, index].sort((a, b) => a - b)
                                : current.filter((item) => item !== index),
                            )
                          }
                        />
                        Original {index + 1}
                      </label>
                    ))}
                  </fieldset>
                )}
                <div className="actions">
                  <button className="primary" type="submit" disabled={busy}>
                    Publish
                  </button>
                </div>
              </form>
              {openAppeal && (
                <form
                  className="form-grid"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act(
                      'staff-keep-private',
                      { reportId, reason, ...(note.trim() ? { note: note.trim() } : {}) },
                      'Kept private. The resident sees your reason.',
                    );
                  }}
                >
                  <h2>Or keep it private</h2>
                  <label>
                    Reason the resident sees
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value as KeepPrivateReason)}
                    >
                      {(Object.keys(KEEP_PRIVATE_LABELS) as KeepPrivateReason[]).map((key) => (
                        <option key={key} value={key}>
                          {KEEP_PRIVATE_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Note to the resident (optional)
                    <textarea
                      rows={3}
                      value={note}
                      maxLength={500}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <div className="actions">
                    <button type="submit" disabled={busy}>
                      Keep private
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : report.published ? (
            <>
              <h2>Public record</h2>
              <p>
                <strong>{report.published.title}</strong>
              </p>
              <p>{report.published.summary}</p>
              <p className="muted">{report.published.area}</p>
              <p className="small muted">
                Published after{' '}
                {report.published.reviewMethod === 'staff' ? 'human review' : 'automatic checks'}
                {report.published.moderationHold
                  ? ` · ${report.published.moderationHold.status === 'hidden' ? 'hidden pending review' : 'removed'}`
                  : ''}
              </p>
              <div className="photo-grid">
                {report.published.photos.map((photo) => (
                  <Photo
                    key={photo.storedIndex}
                    base64={photo.base64}
                    label={`Public photo ${photo.storedIndex + 1}`}
                    {...(photo.removed
                      ? { note: 'removed' }
                      : photo.hidden
                        ? { note: 'hidden' }
                        : {})}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="muted">This report is not held and has no public record to review.</p>
          )}
        </section>
      </div>
      {(report.flags.length > 0 || report.checks.length > 0) && (
        <section className="panel content-panel">
          <h2>Complaints</h2>
          {openFlags.map((flag) => (
            <div key={flag.key} className="flag-row">
              <div>
                <strong>
                  {flag.target.type === 'issue'
                    ? 'Whole issue'
                    : flag.target.type === 'photo'
                      ? `Public photo ${(flag.target.storedIndex ?? 0) + 1}`
                      : 'Community visit photos'}
                </strong>{' '}
                {flag.priority === 'high' && <span className="badge high">Priority</span>}{' '}
                <span className="muted">
                  {flag.status === 'auto-hidden' ? 'hidden pending review' : 'still visible'} ·{' '}
                  {flag.reporters - flag.baseline} reporter(s)
                </span>{' '}
                <Due at={flag.dueBy} />
              </div>
              <div className="actions">
                <button type="button" disabled={busy} onClick={() => resolveFlag(flag, 'restore')}>
                  {flag.status === 'auto-hidden' ? 'Restore' : 'Dismiss'}
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => resolveFlag(flag, 'remove')}
                >
                  Remove
                </button>
                {flag.target.type === 'check' && flag.target.checkId && (
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => block(flag.target.checkId)}
                  >
                    Block this visitor
                  </button>
                )}
              </div>
            </div>
          ))}
          {!openFlags.length && <p className="muted">No open complaints.</p>}
          {report.checks.map((check) => (
            <div key={check.checkId} className="photo-grid">
              {check.photos.map((base64, index) => (
                <Photo
                  key={index}
                  base64={base64}
                  label={`Visit ${formatDate(check.createdAt)} · photo ${index + 1}`}
                />
              ))}
            </div>
          ))}
          <h2>What reporters said</h2>
          <ul className="history">
            {report.complaints.map((item, index) => (
              <li key={index}>
                {item.reasonLabel}
                {item.note ? ` — “${item.note}”` : ''}{' '}
                <span className="muted small">{formatDate(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
