import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  COMPLAINT_REASONS,
  REVIEW_REASONS,
  categoryLabel,
  type CategoryId,
  type ComplaintReason,
  type ReviewReason,
} from '@civic263/domain';
import { staffCall, staffError } from '../lib/firebase';

export const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export function Due({ at }: { at: string }) {
  const overdue = Date.parse(at) < Date.now();
  return (
    <span className={overdue ? 'badge overdue' : 'badge'}>
      {overdue ? 'Overdue · ' : 'Due '}
      {formatDate(at)}
    </span>
  );
}

function useQueue<T>(queue: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    staffCall<{ items: T[] }>('staff-queue', { queue })
      .then((result) => setItems(result.items))
      .catch((reason: unknown) => setError(staffError(reason)));
  }, [queue]);
  useEffect(load, [load]);
  return { items, error, reload: load };
}

function QueuePage<T>({
  title,
  description,
  queue,
  empty,
  head,
  row,
}: {
  title: string;
  description: string;
  queue: string;
  empty: string;
  head: string[];
  row: (item: T) => ReactNode;
}) {
  const { items, error, reload } = useQueue<T>(queue);
  return (
    <>
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
        <button type="button" onClick={reload}>
          Refresh
        </button>
      </header>
      {error && (
        <p role="alert" className="form-message">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="panel-head">
          <h2>{items ? `${items.length} waiting` : 'Loading…'}</h2>
        </div>
        {items && !items.length ? (
          <p className="empty">{empty}</p>
        ) : (
          <div className="table-wrap">
            <table className="queue-table">
              <thead>
                <tr>
                  {head.map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{items?.map(row)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

type Appeal = {
  reportId: string;
  reference: string;
  categoryId: CategoryId;
  reviewReason: ReviewReason | null;
  requestedAt: string;
  dueBy: string;
  note?: string;
};
export function AppealsQueue() {
  return (
    <QueuePage<Appeal>
      title="Appeals"
      description="Residents asked a person to review a report that automatic checks kept private. Oldest first."
      queue="appeals"
      empty="No open appeals."
      head={['Report', 'Held because', 'Resident note', 'Requested', 'Deadline']}
      row={(item) => (
        <tr key={item.reportId}>
          <td>
            <Link to={`/reports/${item.reportId}`}>{item.reference}</Link>
            <span className="cell-detail">{categoryLabel(item.categoryId)}</span>
          </td>
          <td>{item.reviewReason ? REVIEW_REASONS[item.reviewReason] : '—'}</td>
          <td className="note-cell">{item.note ?? <span className="muted">None</span>}</td>
          <td>{formatDate(item.requestedAt)}</td>
          <td>
            <Due at={item.dueBy} />
          </td>
        </tr>
      )}
    />
  );
}

type Flag = {
  key: string;
  reportId: string;
  reference: string;
  target: { type: 'issue' | 'photo' | 'check'; storedIndex?: number };
  status: 'visible' | 'auto-hidden' | 'restored' | 'removed';
  reporters: number;
  baseline: number;
  reasons: Partial<Record<ComplaintReason, number>>;
  priority: 'high' | 'normal';
  dueBy: string;
};
const TARGET_LABELS = { issue: 'Whole issue', photo: 'Report photo', check: 'Visit photos' };
export function ComplaintsQueue() {
  return (
    <QueuePage<Flag>
      title="Complaints"
      description="Public content residents reported. Personal information and danger first, then the oldest deadline. Three different reporters hide an item until you decide."
      queue="complaints"
      empty="No open complaints."
      head={['Content', 'Status', 'Reasons', 'Reporters', 'Deadline']}
      row={(item) => (
        <tr key={item.key}>
          <td>
            <Link to={`/reports/${item.reportId}`}>{item.reference}</Link>
            <span className="cell-detail">
              {TARGET_LABELS[item.target.type]}
              {item.target.type === 'photo' ? ` ${(item.target.storedIndex ?? 0) + 1}` : ''}
            </span>
          </td>
          <td>
            {item.priority === 'high' && <span className="badge high">Priority</span>}{' '}
            {item.status === 'auto-hidden' ? 'Hidden pending review' : 'Still visible'}
          </td>
          <td>
            {(Object.entries(item.reasons) as [ComplaintReason, number][])
              .map(([reason, count]) => `${COMPLAINT_REASONS[reason]} (${count})`)
              .join('; ')}
          </td>
          <td className="numeric">{item.reporters - item.baseline}</td>
          <td>
            <Due at={item.dueBy} />
          </td>
        </tr>
      )}
    />
  );
}

type Held = {
  reportId: string;
  reference: string;
  categoryId: CategoryId;
  reviewReason: ReviewReason | null;
  createdAt: string;
  appeal: { status: string } | null;
  photoCount: number;
};
export function HeldQueue() {
  return (
    <QueuePage<Held>
      title="Held reports"
      description="Every report automatic checks kept private. You can publish one without an appeal if it is clearly a useful public issue."
      queue="held"
      empty="No held reports."
      head={['Report', 'Held because', 'Photos', 'Received', 'Appeal']}
      row={(item) => (
        <tr key={item.reportId}>
          <td>
            <Link to={`/reports/${item.reportId}`}>{item.reference}</Link>
            <span className="cell-detail">{categoryLabel(item.categoryId)}</span>
          </td>
          <td>{item.reviewReason ? REVIEW_REASONS[item.reviewReason] : '—'}</td>
          <td className="numeric">{item.photoCount}</td>
          <td>{formatDate(item.createdAt)}</td>
          <td>{item.appeal ? item.appeal.status.replace('-', ' ') : '—'}</td>
        </tr>
      )}
    />
  );
}

type Block = {
  blockId: string;
  blockedAt: string;
  note: string;
  source: { reference: string | null; kind: string };
};
export function BlocksQueue() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  return (
    <div key={version}>
      {message && (
        <p role="status" className="form-message">
          {message}
        </p>
      )}
      <QueuePage<Block>
        title="Blocked identities"
        description="Blocked identities can still read, withdraw and delete their own data, but cannot add reports, visits, appeals or complaints."
        queue="blocks"
        empty="No blocked identities."
        head={['Identity', 'Blocked', 'Reason', 'Source', '']}
        row={(item) => (
          <tr key={item.blockId}>
            <td>
              <code>{item.blockId.slice(0, 12)}</code>
            </td>
            <td>{formatDate(item.blockedAt)}</td>
            <td className="note-cell">{item.note}</td>
            <td>
              {item.source.reference ?? '—'}
              <span className="cell-detail">{item.source.kind.replace('-', ' ')}</span>
            </td>
            <td>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  const note = window.prompt('Why are you unblocking this identity? (audited)');
                  if (!note?.trim()) return;
                  setBusy(item.blockId);
                  staffCall('staff-unblock', { blockId: item.blockId, note: note.trim() })
                    .then(() => {
                      setMessage('Identity unblocked.');
                      setVersion((value) => value + 1);
                    })
                    .catch((reason: unknown) => setMessage(staffError(reason)))
                    .finally(() => setBusy(null));
                }}
              >
                Unblock
              </button>
            </td>
          </tr>
        )}
      />
    </div>
  );
}
