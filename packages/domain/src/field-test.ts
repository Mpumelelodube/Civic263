import type { IssueLocation } from './models.ts';
export type FieldTestEventKind = 'left' | 'entered' | 'notified';
export type FieldTestSource = 'geofence' | 'movement';
export interface FieldTestSession {
  id: string;
  location: IssueLocation;
  expiresAt: string;
  status: 'waiting-to-leave' | 'outside' | 'returned' | 'notified';
  events: { kind: FieldTestEventKind; source: FieldTestSource; createdAt: string }[];
}
export function advanceFieldTest(
  session: FieldTestSession,
  kind: FieldTestEventKind,
  source: FieldTestSource,
  now = Date.now(),
): FieldTestSession {
  if (Date.parse(session.expiresAt) <= now) throw new Error('This private test has expired.');
  const next =
    kind === 'left' && session.status === 'waiting-to-leave'
      ? 'outside'
      : kind === 'entered' && session.status === 'outside'
        ? 'returned'
        : kind === 'notified' && session.status === 'returned'
          ? 'notified'
          : null;
  if (!next) return session;
  return {
    ...session,
    status: next,
    events: [...session.events, { kind, source, createdAt: new Date(now).toISOString() }].slice(
      -10,
    ),
  };
}
