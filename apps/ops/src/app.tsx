import { useEffect, useState, type FormEvent } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { Brand, Notice } from '@civic263/web-ui';
import { RESPONSE_TARGET_WORKING_DAYS } from '@civic263/domain';
import { getStaffServices, staffCall, staffError } from './lib/firebase';
import { AppealsQueue, BlocksQueue, ComplaintsQueue, HeldQueue } from './pages/queues';
import { ReportReview } from './pages/report-review';

type Operator = { email: string; role: string };

function SignIn({ notice }: { notice?: string | null }) {
  const services = getStaffServices();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(notice ?? null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!services) return;
    setBusy(true);
    setMessage(null);
    try {
      await signInWithEmailAndPassword(services.auth, email.trim(), password);
    } catch (error) {
      setMessage(staffError(error));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!services || !email.trim()) {
      setMessage('Enter your email address first.');
      return;
    }
    await sendPasswordResetEmail(services.auth, email.trim()).catch(() => {});
    setMessage('If that email belongs to an operator account, a reset link is on its way.');
  }
  return (
    <main className="sign-in">
      <Brand label="Civic263 Ops" />
      <h1>Operator sign-in</h1>
      <p className="muted">
        For named Civic263 reviewers only. Every action you take is recorded in the moderation
        audit.
      </p>
      {!services ? (
        <Notice>
          This console is not configured. Add the Firebase web settings to .env.local.
        </Notice>
      ) : (
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {message && (
            <p role="alert" className="form-message">
              {message}
            </p>
          )}
          <div className="actions">
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" onClick={() => void reset()} disabled={busy}>
              Forgot password
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

export function App() {
  const services = getStaffServices();
  const [user, setUser] = useState<User | null | undefined>(services ? undefined : null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  useEffect(() => {
    if (!services) return;
    return onAuthStateChanged(services.auth, (next) => {
      setUser(next);
      setOperator(null);
      if (!next) return;
      // The server decides who is an operator; a signed-in account alone sees nothing.
      staffCall<Operator>('staff-profile')
        .then(setOperator)
        .catch(async (error: unknown) => {
          setDenied(staffError(error));
          await signOut(services.auth);
        });
    });
  }, [services]);
  if (user === undefined || (user && !operator))
    return (
      <main className="sign-in">
        <p className="muted">Checking operator access…</p>
      </main>
    );
  if (!user || !operator) return <SignIn notice={denied} />;
  return (
    <BrowserRouter>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <div className="shell">
        <aside className="sidebar">
          <div>
            <Link className="brand-link" to="/">
              <Brand label="Civic263 Ops" />
            </Link>
            <p className="scope">Moderation · {operator.email}</p>
          </div>
          <nav aria-label="Operations">
            <NavLink to="/appeals">Appeals</NavLink>
            <NavLink to="/complaints">Complaints</NavLink>
            <NavLink to="/held">Held reports</NavLink>
            <NavLink to="/blocks">Blocked identities</NavLink>
          </nav>
          <div className="sidebar-note">
            <p>
              Target: a first decision within {RESPONSE_TARGET_WORKING_DAYS} working days. Personal
              information and danger first.
            </p>
            <button type="button" onClick={() => services && void signOut(services.auth)}>
              Sign out
            </button>
          </div>
        </aside>
        <main id="content">
          <Routes>
            <Route path="/" element={<Navigate to="/appeals" replace />} />
            <Route path="/appeals" element={<AppealsQueue />} />
            <Route path="/complaints" element={<ComplaintsQueue />} />
            <Route path="/held" element={<HeldQueue />} />
            <Route path="/blocks" element={<BlocksQueue />} />
            <Route path="/reports/:reportId" element={<ReportReview />} />
            <Route path="*" element={<Navigate to="/appeals" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
