import { isOpenIncident, categoryLabel, workflowLabel } from '@civic263/domain';
import { usePublicRegister } from '../lib/public-register';
import { downloadPublicCsv } from '../lib/download-csv';

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
          Automated text and photo checks determine whether an observation is suitable for
          publication. Photos with detected faces, readable text or unsafe content stay private.
          Uncertain reports also stay private. Automated checks can make mistakes; publication is
          not independent verification. It does not establish that a field inspection occurred.
          Sending information to a responsible service and receiving its acknowledgement are
          separate evidenced events.
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
          The resident app submits reports and compressed photos privately. Automatic publication
          checks create a separate public record for eligible observations. Handoffs to responsible
          services are recorded separately when they occur.
        </p>
        <p>
          The platform is independent unless a formal municipal partnership is established. No
          authority partnership, monitoring hours or repair service is represented by this platform.
        </p>
      </article>
    </>
  );
}
