import { useEffect, useState } from 'react';
import { FIELD_CHECK_LABELS, type PublicFieldCheck } from '@civic263/domain';
import { PUBLIC_API } from '../lib/public-register';

export function CommunityHistory({ reportId, version }: { reportId: string; version: number }) {
  const [items, setItems] = useState<PublicFieldCheck[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    setBusy(true);
    setError(false);
    const timer = setTimeout(() => abort.abort(), 20000);
    void fetch(`${PUBLIC_API}/incidents/${reportId}/checks`, {
      signal: abort.signal,
      cache: 'no-cache',
    })
      .then(async (response) => {
        if (!response.ok) throw Error();
        return response.json() as Promise<{ items: PublicFieldCheck[]; nextCursor: string | null }>;
      })
      .then((result) => {
        if (active) {
          setItems(result.items);
          setCursor(result.nextCursor);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      abort.abort();
      clearTimeout(timer);
    };
  }, [reportId, version, retry]);
  async function more() {
    if (!cursor || busy) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(
        `${PUBLIC_API}/incidents/${reportId}/checks?cursor=${encodeURIComponent(cursor)}`,
        { signal: AbortSignal.timeout(20000), cache: 'no-cache' },
      );
      if (!response.ok) throw Error();
      const result = (await response.json()) as {
        items: PublicFieldCheck[];
        nextCursor: string | null;
      };
      setItems((current) => [
        ...new Map([...current, ...result.items].map((item) => [item.id, item])).values(),
      ]);
      setCursor(result.nextCursor);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Community field visits">
      <h2>Community field visits</h2>
      {busy && !items.length && <p className="muted">Loading community visits…</p>}
      {error && (
        <p role="alert">
          Could not load the latest visit history.{' '}
          <button onClick={() => setRetry((value) => value + 1)}>Retry</button>
        </p>
      )}
      {!busy && !error && !items.length && (
        <p className="muted">No community visits recorded yet.</p>
      )}
      {items.map((item) => (
        <article key={item.id}>
          <h3>{FIELD_CHECK_LABELS[item.kind]}</h3>
          <p className="muted small">
            {new Date(item.createdAt).toLocaleString()} /{' '}
            {item.evidenceStatus === 'pending'
              ? 'Photos awaiting automatic privacy checks'
              : item.photoCount
                ? 'Photos cleared for public viewing'
                : 'Visit originals remain private'}
          </p>
          <div className="report-gallery">
            {Array.from({ length: item.photoCount }, (_, index) => {
              const uri = `${PUBLIC_API}/incidents/${reportId}/checks/${item.id}/photos/${index}`;
              return (
                <a key={index} href={uri} target="_blank" rel="noopener noreferrer">
                  <img
                    src={uri}
                    alt={`${FIELD_CHECK_LABELS[item.kind]} photo ${index + 1}`}
                    loading="lazy"
                  />
                </a>
              );
            })}
          </div>
        </article>
      ))}
      {cursor && (
        <button disabled={busy} onClick={() => void more()}>
          More community visits
        </button>
      )}
    </section>
  );
}
