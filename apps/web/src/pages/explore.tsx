import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CATEGORIES,
  HANDOFF_LABELS,
  WORKFLOW_LABELS,
  categoryLabel,
  isOpenIncident,
} from '@civic263/domain';
import { DEMO_AS_OF, DEMO_INCIDENTS, ageInDays } from '../data/demo-incidents';
import { SchematicMap } from '../components/schematic-map';
import { downloadDemoCsv } from '../lib/download-csv';

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const category = params.get('category') ?? 'all';
  const progress = params.get('progress') ?? 'all';
  const [selectedId, setSelectedId] = useState(DEMO_INCIDENTS[0]?.id);
  const [showMap, setShowMap] = useState(false);
  const filtered = DEMO_INCIDENTS.filter(
    (item) =>
      (category === 'all' || item.categoryId === category) &&
      (progress === 'all' ||
        (progress === 'open' ? isOpenIncident(item) : !isOpenIncident(item))) &&
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
          <h1>Harare issue register</h1>
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
            placeholder="Search the demonstration register"
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
            <option value="resolved">Resolution recorded</option>
          </select>
        </label>
      </div>
      <div className="finding" aria-live="polite">
        <strong>
          {openCount} open issue{openCount === 1 ? '' : 's'}
        </strong>
        <span>{filtered.length} published examples in this view</span>
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
            <span>Fictional examples</span>
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
                    Evidence: {ageInDays(item.lastApprovedEvidenceAt)} /{' '}
                    {WORKFLOW_LABELS[item.workflowStatus]}
                  </span>
                </button>
              ))
            ) : (
              <p className="empty">
                No reviewed examples match these filters. This does not establish that there are no
                faults.
              </p>
            )}
          </div>
        </section>
        <section className="panel map-panel" aria-label="Selected issue and map">
          <SchematicMap incidents={filtered} selectedId={selected?.id} onSelect={setSelectedId} />
          {selected ? (
            <div className="selected-detail">
              <h2>{selected.title}</h2>
              <p>
                {selected.reference} / {selected.area}
              </p>
              <div className="evidence-strip">
                <span>{WORKFLOW_LABELS[selected.workflowStatus]}</span>
                <span>First report: {ageInDays(selected.firstAcceptedAt)}</span>
                <span>Evidence: {ageInDays(selected.lastApprovedEvidenceAt)}</span>
              </div>
              <p>{HANDOFF_LABELS[selected.handoffStatus]}</p>
              <Link className="text-link" to={`/issues/${selected.reference}`}>
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
            Eight fictional examples demonstrate the product. Harare is illustrative; the pilot
            municipality is not selected.
          </p>
          <Link className="text-link" to="/methodology">
            Understand the evidence
          </Link>
        </section>
        <section className="panel content-panel">
          <h2>Reuse the public record</h2>
          <p className="muted small">
            This sample download contains the {filtered.length} records in the current view, with
            the fixed demonstration as-of time.
          </p>
          <button onClick={() => downloadDemoCsv(filtered, DEMO_AS_OF)}>Download sample CSV</button>
        </section>
      </div>
    </>
  );
}
