import { isOpenIncident, categoryLabel, WORKFLOW_LABELS } from '@civic263/domain';
import { DEMO_AS_OF, DEMO_INCIDENTS } from '../data/demo-incidents';
import { downloadDemoCsv } from '../lib/download-csv';

export function DataPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Public incident data</h1>
          <p className="muted">Reviewed fields, defined scope and clear reuse terms.</p>
        </div>
      </header>
      <section className="panel content-panel">
        <h2>Fictional sample dataset</h2>
        <p>
          Eight invented records demonstrate the export format. Snapshot as of {DEMO_AS_OF}. This is
          not a live Zimbabwe service-delivery dataset.
        </p>
        <button className="primary" onClick={() => downloadDemoCsv(DEMO_INCIDENTS, DEMO_AS_OF)}>
          Download fictional sample CSV
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
              {DEMO_INCIDENTS.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.title}
                    <br />
                    <span className="small muted">{item.reference}</span>
                  </td>
                  <td>{categoryLabel(item.categoryId)}</td>
                  <td>{WORKFLOW_LABELS[item.workflowStatus]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Live downloads will require reviewed publication, snapshot versioning, coverage notes and
          agreed metadata reuse terms. Private identities and original media will remain excluded.
        </p>
      </section>
    </>
  );
}

export function AreasPage() {
  const areas = [...new Set(DEMO_INCIDENTS.map((item) => item.area))].sort();
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
        <h2>Demonstration coverage</h2>
        <p>
          Each area below contains a fictional example. No-report areas are not shown as fault-free.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Area</th>
                <th className="numeric">Open examples</th>
                <th className="numeric">Resolution recorded</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area}>
                  <td>{area}</td>
                  <td className="numeric">
                    {
                      DEMO_INCIDENTS.filter((item) => item.area === area && isOpenIncident(item))
                        .length
                    }
                  </td>
                  <td className="numeric">
                    {
                      DEMO_INCIDENTS.filter((item) => item.area === area && !isOpenIncident(item))
                        .length
                    }
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
          A report is one resident's submission. An incident is the real-world problem that
          operators manage. Several reports may support one public incident.
        </p>
        <h2>Review and acknowledgement</h2>
        <p>
          Review determines whether information is suitable for publication. It does not establish
          that a field inspection occurred. Sending information to a responsible service and
          receiving its acknowledgement are separate evidenced events.
        </p>
        <h2>Freshness and resolution</h2>
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
        <h2>Immediate danger</h2>
        <p>
          Submitting an issue does not dispatch emergency services. Verified local emergency
          guidance must be configured for the pilot before urgent categories go live.
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
          Civic263 is being developed as a public municipal issue register for Zimbabwe, supported
          by an Expo resident app and a private operations dashboard.
        </p>
        <p>
          The resident app currently saves device-local drafts. Live reporting, staff moderation,
          Google Maps and service handoffs will be connected in subsequent phases.
        </p>
        <p>
          The platform is independent unless a formal municipal partnership is established. No
          authority partnership, monitoring hours or repair service is represented by this
          demonstration.
        </p>
      </article>
    </>
  );
}
