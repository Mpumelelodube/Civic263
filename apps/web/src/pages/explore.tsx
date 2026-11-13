import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CATEGORIES,
  HANDOFF_LABELS,
  workflowLabel,
  categoryLabel,
  isOpenIncident,
} from '@civic263/domain';
import {
  usePublicRegister,
  evidenceAge as ageInDays,
  publicPhotoUrl,
} from '../lib/public-register';
import { PublicMap } from '../components/public-map';
import { downloadPublicCsv } from '../lib/download-csv';

export function ExplorePage() {
  const { incidents, asOf, loading, error, nextCursor } = usePublicRegister();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const category = params.get('category') ?? 'all';
  const progress = params.get('progress') ?? 'all';
  const [selectedId, setSelectedId] = useState(incidents[0]?.id);
  const [showMap, setShowMap] = useState(false);
  const filtered = incidents.filter(
    (item) =>
      (category === 'all' || item.categoryId === category) &&
      (progress === 'all' ||
        (progress === 'open'
          ? isOpenIncident(item)
          : progress === 'pending'
            ? item.workflowStatus === 'resolution-pending'
            : item.workflowStatus === 'resolved')) &&
      `${item.title} ${item.area} ${item.reference}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const openCount = filtered.filter(isOpenIncident).length;
  function changeFilter(key: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value && value !== 'all') next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Public issue register</h1>
          <p className="muted">Reported faults, reviewed evidence and what happened next.</p>
        </div>
        <Link className="primary" to="/data">
          Explore public data
        </Link>
      </header>
      <div className="filters">
        <label className="search">
          Find a road, area or reference
          <input
            type="search"
            value={query}
            onChange={(event) => changeFilter('q', event.target.value)}
            placeholder="Search published reports"
          />
        </label>
        <label>
          Service
          <select
            value={category}
            onChange={(event) => changeFilter('category', event.target.value)}
          >
            <option value="all">All services</option>
            {CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Progress
          <select
            value={progress}
            onChange={(event) => changeFilter('progress', event.target.value)}
          >
            <option value="all">All issues</option>
            <option value="open">Open issues</option>
            <option value="pending">Awaiting community confirmation</option>
            <option value="resolved">Resolved reports</option>
          </select>
        </label>
      </div>
      <div className="finding" aria-live="polite">
        <strong>
          {openCount} open issue{openCount === 1 ? '' : 's'}
        </strong>
        <span>{filtered.length} published reports loaded in this view</span>
      </div>
      <div className="view-switch" aria-label="Explorer view">
        <button aria-pressed={!showMap} onClick={() => setShowMap(false)}>
          Issue list
        </button>
        <button aria-pressed={showMap} onClick={() => setShowMap(true)}>
          Map
        </button>
      </div>
      <div className={`explorer ${showMap ? 'show-map' : ''}`}>
        <section className="panel register-panel">
          <div className="panel-head">
            <h2>Reviewed incidents</h2>
            <span>Resident observations</span>
          </div>
          <div className="issue-list">
            {filtered.length ? (
              filtered.map((item) => (
                <button
                  className={`issue-row ${selected?.id === item.id ? 'selected' : ''}`}
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setShowMap(true);
                  }}
                >
                  <span className="issue-title">{item.title}</span>
                  <span className="issue-meta">
                    <span>
                      {item.area} / {categoryLabel(item.categoryId)}
                    </span>
                  </span>
                  <span className="evidence-line">
                    Evidence: {ageInDays(item.lastApprovedEvidenceAt)} / {workflowLabel(item)}
                  </span>
                </button>
              ))
            ) : (
              <p className="empty">
                {loading
                  ? 'Loading published reports...'
                  : error
                    ? 'Reports could not be loaded. Use Retry above.'
                    : 'No published reports match this view. This does not establish that there are no faults.'}
              </p>
            )}
          </div>
        </section>
        <section className="panel map-panel" aria-label="Selected issue and map">
          <PublicMap incidents={filtered} selectedId={selected?.id} onSelect={setSelectedId} />
          {selected ? (
            <div className="selected-detail">
              <h2>{selected.title}</h2>
              {selected.photoCount ? (
                <img
                  className="report-cover"
                  src={publicPhotoUrl(selected.id, 0)}
                  alt="Approved photo of the reported issue"
                  loading="lazy"
                />
              ) : null}
              <p>
                {selected.reference} / {selected.area}
              </p>
              <div className="evidence-strip">
                <span>{workflowLabel(selected)}</span>
                <span>First report: {ageInDays(selected.firstAcceptedAt)}</span>
                <span>Evidence: {ageInDays(selected.lastApprovedEvidenceAt)}</span>
              </div>
              <p>{HANDOFF_LABELS[selected.handoffStatus]}</p>
              <Link className="text-link" to={`/issues/${selected.id}`}>
                Read evidence and history
              </Link>
            </div>
          ) : (
            <p className="empty">No issue selected.</p>
          )}
        </section>
      </div>
      <div className="below">
        <section className="panel content-panel">
          <h2>What this record covers</h2>
          <p className="muted small">
            Published resident observations from the loaded register. Text and photos pass automatic
            privacy and relevance checks; service responsibility remains unassigned until confirmed.
          </p>
          <Link className="text-link" to="/methodology">
            Understand the evidence
          </Link>
        </section>
        <section className="panel content-panel">
          <h2>Reuse the public record</h2>
          <p className="muted small">
            {filtered.length} loaded records match this view.{' '}
            {nextCursor
              ? 'Load more above to include older reports.'
              : 'All currently loaded records are included.'}
          </p>
          <button
            disabled={!asOf}
            onClick={() => {
              if (asOf) downloadPublicCsv(filtered, asOf);
            }}
          >
            Download this view as CSV
          </button>
        </section>
      </div>
    </>
  );
}
