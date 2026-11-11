import type { ReactNode } from 'react';

export function Brand({ label = 'Civic263' }: { label?: string }) {
  return (
    <span className="brand">
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path
          d="M5 21V9h6v12M17 21V4h6v17M2 24h24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      {label}
    </span>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice" role="note">
      {children}
    </div>
  );
}
