import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { Brand, Notice } from '@civic263/web-ui';

function StaffBoundary({ title }: { title: string }) {
  return (
    <>
      <header className="page-header">
        <h1>{title}</h1>
      </header>
      <section className="panel staff-boundary">
        <h2>Staff access is not enabled</h2>
        <p>
          This operations application is scaffolded. No private reports, incident records or staff
          actions are loaded.
        </p>
        <p className="muted">
          Named staff authentication and active municipality permissions must be connected before
          operational access is available.
        </p>
        <h2>Planned workflow</h2>
        <p>
          Review resident submissions, combine duplicates, assign responsible services, record
          evidence and publish approved incident updates.
        </p>
      </section>
    </>
  );
}
export function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <aside className="sidebar">
          <div>
            <Link className="brand-link" to="/">
              <Brand label="Civic263 Ops" />
            </Link>
            <p className="scope">Private operations</p>
          </div>
          <nav aria-label="Operations">
            <NavLink to="/" end>
              Overview
            </NavLink>
            <NavLink to="/review">Review inbox</NavLink>
            <NavLink to="/incidents">Incidents</NavLink>
            <NavLink to="/administration">Administration</NavLink>
          </nav>
        </aside>
        <main>
          <Notice>
            Operations scaffold. Private access remains closed until staff authentication and
            authorization are implemented.
          </Notice>
          <Routes>
            <Route path="/" element={<StaffBoundary title="Overview" />} />
            <Route path="/review" element={<StaffBoundary title="Review inbox" />} />
            <Route path="/incidents" element={<StaffBoundary title="Incidents" />} />
            <Route path="/administration" element={<StaffBoundary title="Administration" />} />
            <Route path="*" element={<StaffBoundary title="Page not found" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
