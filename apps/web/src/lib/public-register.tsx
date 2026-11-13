import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PublicIncident, PublicIncidentResponse } from '@civic263/domain';

export const PUBLIC_API =
  (import.meta.env.VITE_PUBLIC_API_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://europe-west1-civic263-df6ec.cloudfunctions.net/publicApi';
export const publicPhotoUrl = (id: string, index: number) =>
  `${PUBLIC_API}/incidents/${id}/photos/${index}`;

export const publicResolutionPhotoUrl = (id: string, index: number) =>
  `${PUBLIC_API}/incidents/${id}/resolution-photos/${index}`;

export async function readPublicIncident(
  id: string,
  signal?: AbortSignal,
): Promise<PublicIncident> {
  if (!/^[a-f0-9]{40}$/.test(id)) throw new Error('Published issue not found.');
  const response = await fetch(`${PUBLIC_API}/incidents/${id}`, {
    signal: signal ?? null,
    cache: 'no-cache',
  });
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? 'Published issue not found.'
        : 'Could not load this issue. Please retry.',
    );
  return response.json() as Promise<PublicIncident>;
}

type Register = {
  incidents: PublicIncident[];
  asOf: string | null;
  loading: boolean;
  error: string | null;
  nextCursor: string | null;
  refresh: () => void;
  loadMore: () => void;
};
const RegisterContext = createContext<Register | null>(null);
export function PublicRegisterProvider({ children }: { children: ReactNode }) {
  const [incidents, setIncidents] = useState<PublicIncident[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [request, setRequest] = useState<{ cursor?: string; version: number }>({ version: 0 });
  const refresh = useCallback(
    () => setRequest((current) => ({ version: current.version + 1 })),
    [],
  );
  const loadMore = () => {
    if (nextCursor && !loading)
      setRequest((current) => ({ cursor: nextCursor, version: current.version + 1 }));
  };
  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    const timeout = setTimeout(() => abort.abort(), 20000);
    void fetch(`${PUBLIC_API}/incidents${request.cursor ? `?cursor=${request.cursor}` : ''}`, {
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load the public register. Please retry.');
        const result = (await response.json()) as PublicIncidentResponse;
        if (!Array.isArray(result.incidents) || typeof result.asOf !== 'string')
          throw new Error('Invalid register response.');
        if (!active) return;
        setIncidents((current) =>
          request.cursor
            ? [
                ...new Map(
                  [...current, ...result.incidents].map((item) => [item.id, item]),
                ).values(),
              ]
            : result.incidents,
        );
        setAsOf(result.asOf);
        setNextCursor(result.nextCursor);
      })
      .catch(() => {
        if (active) setError('Could not load the public register. Please retry.');
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      abort.abort();
    };
  }, [request]);
  useEffect(() => {
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);
  return (
    <RegisterContext.Provider
      value={{ incidents, asOf, loading, error, nextCursor, refresh, loadMore }}
    >
      {children}
    </RegisterContext.Provider>
  );
}
export function usePublicRegister() {
  const value = useContext(RegisterContext);
  if (!value) throw new Error('Public register provider missing.');
  return value;
}
export function RegisterState() {
  const register = usePublicRegister();
  return (
    <div aria-live="polite">
      {register.error ? (
        <p role="alert">
          {register.error} <button onClick={register.refresh}>Retry</button>
        </p>
      ) : register.loading ? (
        <p>Loading published reports…</p>
      ) : register.asOf ? (
        <p className="muted small">
          Updated {new Date(register.asOf).toLocaleString()}.{' '}
          <button onClick={register.refresh}>Refresh</button>
        </p>
      ) : null}
      {register.nextCursor && (
        <button disabled={register.loading} onClick={register.loadMore}>
          Load more published reports
        </button>
      )}
    </div>
  );
}

export function evidenceAge(value: string | null) {
  if (!value) return 'No approved evidence';
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86400000));
  return days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} ago`;
}
