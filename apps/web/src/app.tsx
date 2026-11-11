import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { Brand, Notice } from '@civic263/web-ui';
import { ExplorePage } from './pages/explore';
import { IncidentDetailPage } from './pages/incident-detail';
import { AboutPage, AreasPage, DataPage, MethodologyPage } from './pages/information';

export function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="shell">
        <aside className="sidebar">
          <div>
            <Link className="brand-link" to="/">
              <Brand />
            </Link>
            <p className="scope">Zimbabwe / Public register</p>
          </div>
          <nav aria-label="Public register">
            <NavLink to="/" end>
              Explore issues
            </NavLink>
            <NavLink to="/areas">Area summaries</NavLink>
            <NavLink to="/data">Public data</NavLink>
            <NavLink to="/methodology">How evidence works</NavLink>
            <NavLink to="/about">About Civic263</NavLink>
          </nav>
          <div className="sidebar-note">
            <p>Independent community reporting.</p>
            <p>
              Handoffs and authority acknowledgements are recorded separately from resident
              observations.
            </p>
          </div>
        </aside>
        <main id="main">
          <Notice>
            <strong>Scaffold preview.</strong> All incidents, evidence, figures and map positions
            are fictional. No live reports are loaded.
          </Notice>
          <Routes>
            <Route path="/" element={<ExplorePage />} />
            <Route path="/areas" element={<AreasPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/issues/:reference" element={<IncidentDetailPage />} />
            <Route
              path="*"
              element={
                <section className="panel content-panel">
                  <h1>Page not found</h1>
                  <Link className="text-link" to="/">
                    Return to register
                  </Link>
                </section>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
