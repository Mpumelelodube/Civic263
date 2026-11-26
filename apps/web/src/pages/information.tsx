import { Link } from 'react-router-dom';
import {
  DATA_LICENCE,
  EMERGENCY_GUIDANCE,
  NOT_AN_EMERGENCY_SERVICE,
  OPERATOR,
  PILOT_AREA,
  isOpenIncident,
  categoryLabel,
  workflowLabel,
} from '@civic263/domain';
import { usePublicRegister } from '../lib/public-register';
import { downloadPublicCsv } from '../lib/download-csv';
import { SupportContact } from './policies';

export function DataPage() {
  const { incidents, asOf, nextCursor } = usePublicRegister();
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Public incident data</h1>
          <p className="muted">Reviewed fields, defined scope and clear reuse terms.</p>
        </div>
      </header>
      <section className="panel content-panel">
        <h2>Published resident observations</h2>
        <p>
          {incidents.length} published reports loaded.{' '}
          {nextCursor
            ? 'Load more above to include older records.'
            : 'This view contains the loaded snapshot.'}{' '}
          Private resident identities and original photos are excluded.
        </p>
        <button
          className="primary"
          disabled={!asOf}
          onClick={() => {
            if (asOf) downloadPublicCsv(incidents, asOf);
          }}
        >
          Download loaded public records
        </button>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Issue / reference</th>
                <th>Service</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.title}
                    <br />
                    <span className="small muted">{item.reference}</span>
                  </td>
                  <td>{categoryLabel(item.categoryId)}</td>
                  <td>{workflowLabel(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Downloads contain the public fields loaded in this browser, with their snapshot time. They
          describe participation in Civic263; they are not a complete survey of faults or council
          performance. Photos are not included in CSV exports.
        </p>
      </section>
      <section className="panel content-panel">
        <h2>Reuse terms</h2>
        <p>
          The published text data is licensed under{' '}
          <a
            className="text-link"
            href={DATA_LICENCE.url}
            rel="noreferrer noopener"
            target="_blank"
          >
            {DATA_LICENCE.name}
          </a>
          . Credit it as “{DATA_LICENCE.attribution}”. Photos are not licensed for reuse. Every
          download repeats the licence and credit in its last two columns.{' '}
          <Link className="text-link" to="/terms">
            Full reuse terms
          </Link>
        </p>
        <h2>Fields</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <th scope="row">reference</th>
                <td>Stable public reference; the issue page is /issues/reference.</td>
              </tr>
              <tr>
                <th scope="row">title, area</th>
                <td>Neutral text written during review, and a general area.</td>
              </tr>
              <tr>
                <th scope="row">category</th>
                <td>The service the resident chose.</td>
              </tr>
              <tr>
                <th scope="row">workflow, handoff</th>
                <td>Progress, and whether a responsible service was notified (evidenced only).</td>
              </tr>
              <tr>
                <th scope="row">first_accepted_at, last_evidence_at</th>
                <td>
                  When the issue was first published, and its latest approved evidence (ISO 8601).
                </td>
              </tr>
              <tr>
                <th scope="row">resolution_source, resolved_at</th>
                <td>
                  Who reported a resolution (a resident observation, not an inspection) and when.
                </td>
              </tr>
              <tr>
                <th scope="row">community_status, fix_reported_at, community_reviewed_at</th>
                <td>Residents' on-site fix reports and their independent review.</td>
              </tr>
              <tr>
                <th scope="row">as_of</th>
                <td>When this snapshot was loaded.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function AreasPage() {
  const { incidents } = usePublicRegister();
  const areas = [...new Set(incidents.map((item) => item.area))].sort();
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Area summaries</h1>
          <p className="muted">
            Counts describe participation in this register, not council performance.
          </p>
        </div>
      </header>
      <section className="panel content-panel">
        <h2>Coverage of loaded reports</h2>
        <p>
          Counts use the published reports currently loaded above. Areas without reports are not
          shown as fault-free.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Area</th>
                <th className="numeric">Open reports</th>
                <th className="numeric">Resolution recorded</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area}>
                  <td>{area}</td>
                  <td className="numeric">
                    {incidents.filter((item) => item.area === area && isOpenIncident(item)).length}
                  </td>
                  <td className="numeric">
                    {incidents.filter((item) => item.area === area && !isOpenIncident(item)).length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function MethodologyPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>How evidence works</h1>
          <p className="muted">A public record that explains its source and its limits.</p>
        </div>
      </header>
      <article className="panel content-panel">
        <h2>Reports and incidents</h2>
        <p>
          A report is one resident's submission. An incident is the public record of the reported
          problem. Residents raise issues and record when their own reports have been resolved.
        </p>
        <h2>Review and acknowledgement</h2>
        <p>
          Every report is reviewed before publication, by automatic text and photo checks when they
          are switched on, and otherwise by a Civic263 reviewer. Photos showing faces, readable
          personal text or unsafe content stay private, and so do uncertain reports. Automatic
          checks publish a standard description of the problem, never the resident&rsquo;s own
          words. Each issue says whether it was published after automatic checks or after human
          review. Reviews can make mistakes; publication is not independent verification, and it
          does not establish that a field inspection occurred. Sending information to a responsible
          service and receiving its acknowledgement are separate evidenced events.
        </p>
        <h2>Freshness and resolution</h2>
        <p>
          Residents raise issues and the original reporter can mark their report resolved. Its
          active map pin is removed while the record and approved photos stay available. A
          resolution labelled "Resolved by reporter" records that resident's observation.
        </p>
        <p>
          The latest approved observation determines evidence freshness. An administrative edit does
          not refresh it. Resolution labels must distinguish a resident observation, an authority
          statement and an independent field check.
        </p>
        <h2>Coverage and public data</h2>
        <p>
          The dataset reflects reported and reviewed issues on Civic263. Uneven participation means
          counts cannot be treated as a complete survey of faults or a council league table. Only
          approved, privacy-safe fields may be reused publicly.
        </p>
        <h2 id="emergency">Immediate danger</h2>
        <p>{NOT_AN_EMERGENCY_SERVICE}</p>
        <ul>
          {EMERGENCY_GUIDANCE.numbers.map((item) => (
            <li key={item.number}>
              {item.label}:{' '}
              <a className="text-link" href={`tel:${item.number.replaceAll(' ', '')}`}>
                {item.number}
              </a>
            </li>
          ))}
        </ul>
        <p className="small muted">
          Numbers as published by{' '}
          <a
            className="text-link"
            href={EMERGENCY_GUIDANCE.sourceUrl}
            rel="noreferrer noopener"
            target="_blank"
          >
            {EMERGENCY_GUIDANCE.source}
          </a>
          , checked {new Date(EMERGENCY_GUIDANCE.checkedOn).toLocaleDateString()}.
        </p>
      </article>
    </>
  );
}

export function AboutPage() {
  return (
    <>
      <header className="page-header">
        <h1>About Civic263</h1>
      </header>
      <article className="panel content-panel">
        <h2>Report it. Track what happens.</h2>
        <p>
          Civic263 is a public register of reported municipal issues, in a pilot across {PILOT_AREA}
          . It is run independently by {OPERATOR.name}, with a resident app and a private review
          console.
        </p>
        <p>
          The resident app sends reports and compressed photos privately. After review, eligible
          observations get a separate public record. Handoffs to responsible services are recorded
          separately when they occur.
        </p>
        <p>
          No council or service provider runs or endorses Civic263, and none receives reports from
          it automatically. No monitoring hours or repair service are offered.{' '}
          <Link className="text-link" to="/methodology#emergency">
            In an emergency, call for help first.
          </Link>
        </p>
        <h2>Contact</h2>
        <p>
          Support and privacy requests: <SupportContact />
        </p>
        <p>
          <Link className="text-link" to="/privacy">
            Privacy notice
          </Link>{' '}
          ·{' '}
          <Link className="text-link" to="/terms">
            Terms and data reuse
          </Link>
        </p>
      </article>
    </>
  );
}
