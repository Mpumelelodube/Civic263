import { createHash } from 'node:crypto';
import {
  FieldPath,
  FieldValue,
  getFirestore,
  type Firestore,
  type Query,
} from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError } from 'firebase-functions/v2/https';
import { error as logError } from 'firebase-functions/logger';
import {
  ERASED_RESIDENT,
  WITHDRAWN_SUMMARY,
  canCorrectReport,
  parseAccountDeletion,
  parseReportCorrection,
  parseWithdrawal,
  withdrawalOutcome,
  type AccountDeletionResult,
  type CorrectionReceipt,
  type WithdrawalReceipt,
} from '../../packages/domain/src/account-lifecycle.ts';
import { toPublicIncident } from '../../packages/domain/src/publication.ts';
import { UUID_PATTERN } from '../../packages/domain/src/report-submission.ts';
import { readResolution } from '../../packages/domain/src/report-resolution.ts';
import type { IncidentRecord } from '../../packages/domain/src/models.ts';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const DAY = 86400000;

function parsed<T>(parse: () => T): T {
  try {
    return parse();
  } catch (reason) {
    throw new HttpsError(
      'invalid-argument',
      reason instanceof Error ? reason.message : 'Invalid request.',
    );
  }
}

// The marker holds only a hash, so it cannot be traced back to an erased identity.
export const deletionMarker = (uid: string) =>
  getFirestore().collection('accountDeletions').doc(digest(uid));

// ID tokens stay valid for up to an hour after the Auth user is deleted.
export async function assertAccountActive(uid: string) {
  if ((await deletionMarker(uid).get()).exists)
    throw new HttpsError(
      'permission-denied',
      'This account was deleted. Restart the app to continue with a new identity.',
    );
}

const indexes = (count: unknown) =>
  Array.from(
    { length: Number.isInteger(count) && (count as number) > 0 ? Math.min(count as number, 6) : 0 },
    (_, index) => index,
  );
const batchPaths = (base: string, batch: unknown, count: unknown) =>
  typeof batch === 'string' && UUID_PATTERN.test(batch)
    ? indexes(count).map((index) => `${base}/${batch}/${index}.jpg`)
    : [];
const storedPaths = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (path): path is string =>
          typeof path === 'string' &&
          (path.startsWith('private/reports/') || path.startsWith('public/incidents/')),
      )
    : [];
// Exact object names only: the backend role can delete objects but deliberately cannot list them.
async function deleteObjects(paths: string[]) {
  const bucket = getStorage().bucket();
  await Promise.all(
    [...new Set(paths)].map((path) => bucket.file(path).delete({ ignoreNotFound: true })),
  );
}

export async function withdrawReport(value: unknown, uid: string): Promise<WithdrawalReceipt> {
  const { reportId } = parsed(() => parseWithdrawal(value));
  const db = getFirestore();
  const ref = db.collection('reports').doc(reportId);
  const incidentRef = db.collection('incidents').doc(reportId);
  const publicRef = db.collection('publicIncidents').doc(reportId);
  const { receipt, cleanup } = await db.runTransaction(async (transaction) => {
    const report = (await transaction.get(ref)).data();
    if (!report || report.ownerUid !== uid) throw new HttpsError('not-found', 'Report not found.');
    if (report.moderationStatus === 'withdrawn' && report.withdrawal)
      return {
        receipt: { reportId, ...report.withdrawal } as WithdrawalReceipt,
        cleanup: storedPaths(report.mediaCleanup),
      };
    const [checks, canonical, flags] = await Promise.all([
      transaction.get(db.collection('fieldChecks').where('reportId', '==', reportId)),
      transaction.get(incidentRef),
      transaction.get(db.collection('contentFlags').where('reportId', '==', reportId)),
    ]);
    const outcome = withdrawalOutcome({
      published: report.publicationStatus === 'published',
      otherEvidence: checks.docs.some((check) => check.data().actorUid !== uid),
    });
    const withdrawnAt = new Date().toISOString();
    const resolution = readResolution(report.resolution);
    const incident = canonical.data() as IncidentRecord | undefined;
    const own = checks.docs.filter((check) => check.data().actorUid === uid);
    // Everything the reporter contributed, public or private. Recorded with the withdrawal so a
    // retry can finish deleting it after an interruption.
    const media = storedPaths([
      ...storedPaths(report.rawMediaPaths),
      ...storedPaths(report.resolutionEvidence?.rawMediaPaths),
      ...(incident
        ? [
            // Stored derivatives keep their numbering when complaints hide some of them.
            ...indexes(
              (incident as { storedPhotoCount?: number }).storedPhotoCount ?? incident.photoCount,
            ).map((index) => `public/incidents/${reportId}/${index}.jpg`),
            ...batchPaths(
              `public/incidents/${reportId}/resolution`,
              (incident as { resolutionMediaBatchId?: unknown }).resolutionMediaBatchId,
              readResolution(incident.resolution)?.photoCount,
            ),
          ]
        : []),
      ...own.flatMap((check) => [
        ...storedPaths(check.data().rawMediaPaths),
        ...batchPaths(
          `public/incidents/${reportId}/field-checks/${check.id}`,
          check.data().reviewMediaBatchId,
          check.data().photoCount,
        ),
      ]),
    ]);
    transaction.update(ref, {
      moderationStatus: 'withdrawn',
      withdrawal: { outcome, withdrawnAt },
      mediaCleanup: media,
      description: '',
      landmark: '',
      rawMediaPaths: [],
      approvedPhotoIndexes: [],
      resolutionEvidence: FieldValue.delete(),
      reviewLeaseUntil: 0,
      ...(resolution?.evidenceStatus === 'pending'
        ? { resolution: { ...resolution, evidenceStatus: 'private', photoCount: 0 } }
        : {}),
      // Retained issues keep the private pin only as the site anchor for others' 20 m checks.
      ...(outcome === 'retained'
        ? {}
        : { location: FieldValue.delete(), publicationStatus: 'hidden' }),
    });
    if (outcome === 'unpublished') {
      transaction.delete(publicRef);
      // Non-personal tombstone; the AI summary derived from the resident's text is dropped.
      transaction.set(incidentRef, {
        id: reportId,
        reference: report.receipt.reference,
        categoryId: report.categoryId,
        publicationStatus: 'hidden',
        firstAcceptedAt: incident?.firstAcceptedAt ?? null,
        withdrawnAt,
        withdrawalOutcome: outcome,
      });
      for (const check of checks.docs) {
        transaction.delete(check.ref);
        transaction.delete(db.collection('publicFieldChecks').doc(check.id));
      }
    }
    if (outcome === 'retained' && incident) {
      const incidentResolution = readResolution(incident.resolution);
      const changes = {
        summary: WITHDRAWN_SUMMARY,
        photoCount: 0,
        photoOrder: [] as number[],
        ...(incidentResolution
          ? {
              resolution: {
                ...incidentResolution,
                evidenceStatus: 'private' as const,
                photoCount: 0,
              },
            }
          : {}),
        publicationVersion: incident.publicationVersion + 1,
      };
      transaction.update(incidentRef, {
        ...changes,
        resolutionMediaBatchId: null,
        withdrawnAt,
        withdrawalOutcome: outcome,
      });
      // An issue an operator has hidden after complaints stays hidden.
      const projection = (incident as { moderationHold?: unknown }).moderationHold
        ? null
        : toPublicIncident({ ...incident, ...changes });
      if (projection) transaction.set(publicRef, projection);
      for (const check of own) {
        transaction.update(check.ref, {
          evidenceStatus: 'private',
          photoCount: 0,
          rawMediaPaths: [],
          reviewMediaBatchId: null,
          reviewLeaseUntil: 0,
          location: FieldValue.delete(),
          captures: FieldValue.delete(),
        });
        transaction.set(
          db.collection('publicFieldChecks').doc(check.id),
          { evidenceStatus: 'private', photoCount: 0 },
          { merge: true },
        );
      }
    }
    // The appeal holds the resident's own note; complaints about removed material are moot.
    transaction.delete(db.collection('appeals').doc(reportId));
    for (const flag of flags.docs)
      if (flag.data().open && (outcome !== 'retained' || flag.data().target?.type !== 'issue'))
        transaction.update(flag.ref, {
          open: false,
          closedBy: 'withdrawal',
          decidedAt: withdrawnAt,
        });
    transaction.create(db.collection('reportEvents').doc(`${reportId}_withdrawn`), {
      event: 'resident-withdrew',
      reportId,
      outcome,
      occurredAt: withdrawnAt,
    });
    const withdrawal: WithdrawalReceipt = { reportId, outcome, withdrawnAt };
    return { receipt: withdrawal, cleanup: media };
  });
  if (cleanup.length)
    try {
      await deleteObjects(cleanup);
      await ref.update({ mediaCleanup: FieldValue.delete() });
    } catch {
      logError('Withdrawn report media cleanup could not finish', { reportId });
      throw new HttpsError(
        'unavailable',
        'Your report was withdrawn, but its photos are still being removed. Retry to finish.',
      );
    }
  return receipt;
}

export async function correctReport(value: unknown, uid: string): Promise<CorrectionReceipt> {
  const input = parsed(() => parseReportCorrection(value));
  const hash = digest(JSON.stringify(input));
  const db = getFirestore();
  const ref = db.collection('reports').doc(input.reportId);
  const result = await db.runTransaction(async (transaction) => {
    const report = (await transaction.get(ref)).data();
    if (!report || report.ownerUid !== uid) throw new HttpsError('not-found', 'Report not found.');
    const revision = Number.isInteger(report.revision) ? (report.revision as number) : 0;
    if (report.correctionHash === hash && revision === input.revision + 1)
      return { receipt: { reportId: input.reportId, revision }, removed: [] as string[] };
    if (revision !== input.revision)
      throw new HttpsError(
        'failed-precondition',
        'This report changed. Refresh it before correcting.',
      );
    const reviewing = report.reviewStatus === 'processing';
    if (reviewing && report.reviewLeaseUntil > Date.now())
      throw new HttpsError(
        'aborted',
        'Automatic review is checking this report. Try again in a minute.',
      );
    if (
      !canCorrectReport({
        moderationStatus: report.moderationStatus,
        publicationStatus: report.publicationStatus,
        workflowStatus: report.workflowStatus,
        // A processing lease that expired belongs to a worker that stopped; it will retry.
        reviewStatus: reviewing ? 'retrying' : (report.reviewStatus ?? 'queued'),
        correctionCount: report.correctionCount ?? 0,
        appeal: report.appeal ?? null,
      })
    )
      throw new HttpsError(
        'failed-precondition',
        'This report can no longer be corrected. Withdraw it and send a new report instead.',
      );
    const paths = report.rawMediaPaths as string[];
    if (input.keepPhotos.some((index) => index >= paths.length))
      throw new HttpsError('invalid-argument', 'Choose which existing photos to keep.');
    const kept = input.keepPhotos.map((index) => paths[index]!);
    const next = revision + 1;
    const now = new Date().toISOString();
    // Earlier text is overwritten, not versioned, so mistaken personal details can be removed.
    transaction.update(ref, {
      categoryId: input.categoryId,
      description: input.description,
      landmark: input.landmark,
      location: input.location,
      rawMediaPaths: kept,
      revision: next,
      correctionCount: (report.correctionCount ?? 0) + 1,
      correctionHash: hash,
      correctedAt: now,
      reviewStatus: 'queued',
      reviewReason: null,
      reviewAttempts: 0,
      reviewLeaseUntil: 0,
    });
    transaction.create(db.collection('reportEvents').doc(`${input.reportId}_corrected_${next}`), {
      event: 'resident-corrected',
      reportId: input.reportId,
      revision: next,
      occurredAt: now,
    });
    return {
      receipt: { reportId: input.reportId, revision: next },
      removed: paths.filter((path) => !kept.includes(path)),
    };
  });
  const bucket = getStorage().bucket();
  for (const path of result.removed)
    if (path.startsWith(`private/reports/${uid}/${input.reportId}/`))
      await bucket
        .file(path)
        .delete({ ignoreNotFound: true })
        .catch(() => logError('Removed report photo cleanup failed', { reportId: input.reportId }));
  return result.receipt;
}

type Expired = () => boolean;
async function deleteMatches(query: Query, expired: Expired) {
  for (;;) {
    const page = await query.limit(200).get();
    if (page.empty) return true;
    if (expired()) return false;
    const batch = getFirestore().batch();
    for (const doc of page.docs) batch.delete(doc.ref);
    await batch.commit();
  }
}

async function eraseReports(db: Firestore, uid: string, expired: Expired) {
  const now = new Date().toISOString();
  for (;;) {
    const page = await db.collection('reports').where('ownerUid', '==', uid).limit(50).get();
    if (page.empty) return true;
    for (const doc of page.docs) {
      if (expired()) return false;
      // Originals go first, so an interruption never leaves a file its record no longer names.
      // Approved public derivatives of published issues stay as part of the anonymous record;
      // `mediaCleanup` holds only files an unfinished withdrawal already removed from view.
      await deleteObjects([
        ...storedPaths(doc.data().rawMediaPaths),
        ...storedPaths(doc.data().resolutionEvidence?.rawMediaPaths),
        ...storedPaths(doc.data().mediaCleanup),
      ]);
      await db.recursiveDelete(doc.ref.collection('updates'));
      const incidentRef = db.collection('incidents').doc(doc.id);
      const publicRef = db.collection('publicIncidents').doc(doc.id);
      // Serialized with publication, so a running review cannot publish a report being erased.
      await db.runTransaction(async (transaction) => {
        const report = (await transaction.get(doc.ref)).data();
        if (!report || report.ownerUid !== uid) return;
        // Appeals carry the resident's own note; the moderation audit keeps the decision.
        transaction.delete(db.collection('appeals').doc(doc.id));
        if (report.publicationStatus !== 'published') {
          transaction.delete(doc.ref);
          return;
        }
        const resolution = readResolution(report.resolution);
        const pending = resolution?.evidenceStatus === 'pending';
        const [canonical, projection] = pending
          ? await Promise.all([transaction.get(incidentRef), transaction.get(publicRef)])
          : [null, null];
        const privateResolution = pending
          ? { ...resolution!, evidenceStatus: 'private' as const, photoCount: 0 }
          : null;
        // Keep the anonymous public issue and its private site pin; drop the owner and their text.
        transaction.update(doc.ref, {
          ownerUid: FieldValue.delete(),
          ownerErasedAt: now,
          description: '',
          landmark: '',
          rawMediaPaths: [],
          resolutionEvidence: FieldValue.delete(),
          mediaCleanup: FieldValue.delete(),
          ...(privateResolution ? { resolution: privateResolution } : {}),
        });
        const incident = canonical?.data() as IncidentRecord | undefined;
        if (
          privateResolution &&
          incident?.publicationStatus === 'published' &&
          projection?.exists &&
          readResolution(incident.resolution)?.resolvedAt === privateResolution.resolvedAt
        ) {
          const updated = {
            ...incident,
            resolution: privateResolution,
            publicationVersion: incident.publicationVersion + 1,
          };
          transaction.update(incidentRef, {
            resolution: privateResolution,
            publicationVersion: updated.publicationVersion,
          });
          transaction.set(publicRef, toPublicIncident(updated)!);
        }
      });
    }
  }
}

async function eraseFieldChecks(db: Firestore, uid: string, expired: Expired) {
  for (;;) {
    const page = await db.collection('fieldChecks').where('actorUid', '==', uid).limit(100).get();
    if (page.empty) return true;
    if (expired()) return false;
    await deleteObjects(page.docs.flatMap((doc) => storedPaths(doc.data().rawMediaPaths)));
    const batch = db.batch();
    for (const doc of page.docs) {
      // Pending evidence can never be reviewed once its private originals are deleted.
      const pending = doc.data().evidenceStatus === 'pending';
      batch.update(doc.ref, {
        actorUid: ERASED_RESIDENT,
        rawMediaPaths: [],
        location: FieldValue.delete(),
        captures: FieldValue.delete(),
        ...(pending ? { evidenceStatus: 'private', photoCount: 0, reviewLeaseUntil: 0 } : {}),
      });
      if (pending)
        batch.set(
          db.collection('publicFieldChecks').doc(doc.id),
          { evidenceStatus: 'private', photoCount: 0 },
          { merge: true },
        );
    }
    await batch.commit();
  }
}

async function replaceMatches(query: Query, changes: Record<string, unknown>, expired: Expired) {
  for (;;) {
    const page = await query.limit(200).get();
    if (page.empty) return true;
    if (expired()) return false;
    const batch = getFirestore().batch();
    for (const doc of page.docs) batch.update(doc.ref, changes);
    await batch.commit();
  }
}

async function eraseDevices(db: Firestore, uid: string) {
  const registrations = db.collection('communityPushRegistrations');
  const devices = await db.collection('residentDevices').doc(uid).collection('devices').get();
  for (const device of devices.docs) {
    const token = device.data().token;
    if (typeof token !== 'string') continue;
    const registration = registrations.doc(digest(token));
    if ((await registration.get()).data()?.uid === uid) await registration.delete();
  }
  const stale = await registrations.where('uid', '==', uid).get();
  await Promise.all(stale.docs.map((doc) => doc.ref.delete()));
  await db.recursiveDelete(db.collection('residentDevices').doc(uid));
}

async function eraseResidentRecords(db: Firestore, uid: string) {
  await Promise.all([
    db.recursiveDelete(db.collection('residentNotifications').doc(uid)),
    db.recursiveDelete(db.collection('residentCommunity').doc(uid)),
    db.recursiveDelete(db.collection('communityFieldTests').doc(uid)),
    db.collection('placeLookupQuotas').doc(uid).delete(),
    db.collection('residentBlocks').doc(digest(uid)).delete(),
  ]);
  const limits = await db
    .collection('reportRateLimits')
    .where(FieldPath.documentId(), '>=', `${uid}_`)
    .where(FieldPath.documentId(), '<', `${uid}_`)
    .get();
  await Promise.all(limits.docs.map((doc) => doc.ref.delete()));
  // Hashed daily counters; older ones expire through their TTL policies within two days.
  for (const offset of [0, 1]) {
    const day = new Date(Date.now() - offset * DAY).toISOString().slice(0, 10);
    await Promise.all([
      db
        .collection('communityPositionUsage')
        .doc(digest(`${uid}|${day}`))
        .delete(),
      db
        .collection('fieldCheckDailyUsage')
        .doc(digest(`${uid}|${day}`))
        .delete(),
      db
        .collection('complaintDailyUsage')
        .doc(digest(`${uid}|${day}`))
        .delete(),
    ]);
  }
}

export async function deleteResidentAccount(
  value: unknown,
  uid: string,
  budgetMs = 40000,
): Promise<AccountDeletionResult> {
  parsed(() => parseAccountDeletion(value));
  const db = getFirestore();
  const marker = deletionMarker(uid);
  const started = Date.now();
  const expired = () => Date.now() - started > budgetMs;
  await marker.set(
    {
      status: 'erasing',
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(started + 30 * DAY),
    },
    { merge: true },
  );
  // Every step is repeatable; a partial result tells the device to call again.
  const steps: (() => Promise<boolean>)[] = [
    () => eraseReports(db, uid, expired),
    () => eraseFieldChecks(db, uid, expired),
    () =>
      replaceMatches(
        db.collection('reports').where('activeFixProposerUid', '==', uid),
        { activeFixProposerUid: ERASED_RESIDENT },
        expired,
      ),
    () =>
      replaceMatches(
        db.collection('incidents').where('activeFixProposerUid', '==', uid),
        { activeFixProposerUid: ERASED_RESIDENT },
        expired,
      ),
    () =>
      replaceMatches(
        db.collection('reportEvents').where('actorUid', '==', uid),
        { actorUid: ERASED_RESIDENT },
        expired,
      ),
    () =>
      replaceMatches(
        db.collection('reportEvents').where('notificationUids', 'array-contains', uid),
        { notificationUids: FieldValue.arrayRemove(uid) },
        expired,
      ),
    () => deleteMatches(db.collection('reportSubmissions').where('ownerUid', '==', uid), expired),
    // Complaints the resident made; aggregate counts on the reported content remain.
    () =>
      deleteMatches(
        db.collection('contentReports').where('reporterHash', '==', digest(uid)),
        expired,
      ),
    () =>
      deleteMatches(db.collection('fieldCheckSubmissions').where('actorUid', '==', uid), expired),
    () => eraseDevices(db, uid).then(() => !expired()),
    () => eraseResidentRecords(db, uid).then(() => !expired()),
  ];
  try {
    for (const step of steps) if (!(await step())) return { status: 'partial' };
    try {
      await getAuth().deleteUser(uid);
    } catch (reason) {
      if ((reason as { code?: string })?.code !== 'auth/user-not-found') throw reason;
    }
  } catch {
    logError('Account deletion could not finish');
    throw new HttpsError(
      'unavailable',
      'Account deletion did not finish. Keep the app open and retry.',
    );
  }
  await marker.set({ status: 'complete', updatedAt: new Date().toISOString() }, { merge: true });
  return { status: 'complete' };
}
