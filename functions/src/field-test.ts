import { createHash } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  advanceFieldTest,
  type FieldTestSession,
  type FieldTestEventKind,
  type FieldTestSource,
} from '../../packages/domain/src/field-test.ts';
import { parseResolutionFix } from '../../packages/domain/src/report-resolution.ts';
import { UUID_PATTERN } from '../../packages/domain/src/report-submission.ts';
import { exactCommand } from './community.ts';

export async function fieldTestCommand(value: unknown, uid: string, testIdentity: boolean) {
  if (!testIdentity)
    throw new HttpsError(
      'permission-denied',
      'Private field tests are restricted to isolated acceptance accounts.',
    );
  const operation = (value as { operation?: unknown })?.operation;
  if (!['start', 'state', 'event', 'stop'].includes(operation as string))
    throw new HttpsError('invalid-argument', 'Unknown private test operation.');
  const keys =
    operation === 'start'
      ? ['operation', 'attemptId', 'location']
      : operation === 'event'
        ? ['operation', 'testId', 'kind', 'source']
        : ['operation'];
  const data = exactCommand(value, keys);
  const db = getFirestore(),
    ref = db.collection('communityFieldTests').doc(uid);
  return db.runTransaction(async (tx) => {
    const raw = (await tx.get(ref)).data();
    if (operation === 'start') {
      if (typeof data.attemptId !== 'string' || !UUID_PATTERN.test(data.attemptId))
        throw new HttpsError('invalid-argument', 'Invalid test attempt.');
      const id = createHash('sha256')
        .update(uid + '\0' + data.attemptId)
        .digest('hex')
        .slice(0, 40);
      if (raw?.session?.id === id) return { session: raw.session as FieldTestSession };
      let point;
      try {
        point = parseResolutionFix(data.location);
      } catch {
        throw new HttpsError('invalid-argument', 'Use a fresh precise device location.');
      }
      if (
        point.mocked ||
        point.accuracyMeters > 20 ||
        Math.abs(Date.now() - point.timestamp) > 30000
      )
        throw new HttpsError(
          'failed-precondition',
          'Use a fresh non-mocked location accurate within 20 metres.',
        );
      const day = new Date().toISOString().slice(0, 10),
        starts = raw?.day === day ? (raw.starts ?? 0) + 1 : 1;
      if (starts > 10)
        throw new HttpsError(
          'resource-exhausted',
          'The private test start limit has been reached.',
        );
      const expiresAt = new Date(Date.now() + 2 * 3600000);
      const session: FieldTestSession = {
        id,
        location: { latitude: point.latitude, longitude: point.longitude },
        expiresAt: expiresAt.toISOString(),
        status: 'waiting-to-leave',
        events: [],
      };
      tx.set(ref, { session, expiresAt, day, starts });
      return { session };
    }
    if (operation === 'stop') {
      if (raw) tx.update(ref, { expiresAt: new Date(), session: null });
      return { session: null };
    }
    let session = raw?.session as FieldTestSession | undefined;
    if (!session || Date.parse(session.expiresAt) <= Date.now()) return { session: null };
    if (operation === 'state') return { session };
    if (
      operation !== 'event' ||
      data.testId !== session.id ||
      !['left', 'entered', 'notified'].includes(data.kind as string) ||
      !['geofence', 'movement'].includes(data.source as string)
    )
      throw new HttpsError('invalid-argument', 'Invalid private test event.');
    session = advanceFieldTest(
      session,
      data.kind as FieldTestEventKind,
      data.source as FieldTestSource,
    );
    tx.update(ref, { session });
    return { session };
  });
}
