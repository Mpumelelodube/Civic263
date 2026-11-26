import { createHash } from 'node:crypto';
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentSnapshot,
  type Transaction,
} from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError } from 'firebase-functions/v2/https';
import { error as logError } from 'firebase-functions/logger';
import type { CallableRequest } from 'firebase-functions/v2/https';
import sharp from 'sharp';
import {
  COMPLAINT_REASONS,
  DAILY_COMPLAINT_LIMIT,
  KEEP_PRIVATE_LABELS,
  RESPONSE_TARGET_WORKING_DAYS,
  addWorkingDays,
  awaitingStaffReview,
  canRequestReview,
  complaintPriority,
  flagKey,
  parseComplaint,
  parseReviewRequest,
  parseStaffCommand,
  shouldAutoHide,
  type ComplaintReason,
  type ComplaintTarget,
  type FlagStatus,
  type ResidentAppeal,
  type StaffDecision,
} from '../../packages/domain/src/moderation.ts';
import { toPublicIncident } from '../../packages/domain/src/publication.ts';
import { readResolution } from '../../packages/domain/src/report-resolution.ts';
import { UUID_PATTERN } from '../../packages/domain/src/report-submission.ts';
import type { IncidentRecord } from '../../packages/domain/src/models.ts';
import { buildIncident } from './automatic-review.ts';
import { automaticReviewEnabled } from './review-controls.ts';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const db = () => getFirestore();
const now = () => new Date().toISOString();
const dueBy = (from: string) =>
  addWorkingDays(new Date(from), RESPONSE_TARGET_WORKING_DAYS).toISOString();

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

export const blockId = (uid: string) => digest(uid);
/** Blocked identities keep their rights (read, withdraw, delete) but cannot add content. */
export async function assertMayContribute(uid: string) {
  if ((await db().collection('residentBlocks').doc(blockId(uid)).get()).exists)
    throw new HttpsError(
      'permission-denied',
      'This identity can no longer add reports, reviews or complaints. Contact Civic263 support if you think this is a mistake.',
    );
}

// ----- Public photo ordering: hidden photos leave the public sequence without renumbering files.

const storedCount = (incident: DocumentData) =>
  Number.isInteger(incident.storedPhotoCount)
    ? incident.storedPhotoCount
    : (incident.photoCount ?? 0);
export function photoOrder(incident: DocumentData): number[] {
  return Array.isArray(incident.photoOrder)
    ? (incident.photoOrder as number[])
    : Array.from({ length: incident.photoCount ?? 0 }, (_, index) => index);
}

// ----- Resident commands

export async function requestHumanReview(value: unknown, uid: string): Promise<ResidentAppeal> {
  const input = parsed(() => parseReviewRequest(value));
  const ref = db().collection('reports').doc(input.reportId);
  return db().runTransaction(async (transaction) => {
    const report = (await transaction.get(ref)).data();
    if (!report || report.ownerUid !== uid) throw new HttpsError('not-found', 'Report not found.');
    if (report.appeal) return report.appeal as ResidentAppeal;
    if (
      !canRequestReview({
        moderationStatus: report.moderationStatus,
        publicationStatus: report.publicationStatus,
        workflowStatus: report.workflowStatus,
        reviewStatus: report.reviewStatus,
        reviewReason: report.reviewReason ?? null,
        testOnly: report.receipt?.testOnly === true,
      })
    )
      throw new HttpsError(
        'failed-precondition',
        'Only a report kept private after automatic review can be sent for a human review.',
      );
    const requestedAt = now();
    const appeal: ResidentAppeal = { status: 'open', requestedAt, dueBy: dueBy(requestedAt) };
    transaction.update(ref, { appeal });
    // The queue entry holds no identity; operators open the report through the server.
    transaction.set(db().collection('appeals').doc(input.reportId), {
      reportId: input.reportId,
      reference: report.receipt.reference,
      categoryId: report.categoryId,
      reviewReason: report.reviewReason ?? null,
      ...appeal,
      ...(input.note ? { note: input.note } : {}),
    });
    return appeal;
  });
}

type FlagDoc = {
  key: string;
  target: ComplaintTarget & { storedIndex?: number };
  reportId: string;
  reference: string;
  status: FlagStatus;
  reporters: number;
  baseline: number;
  reasons: Partial<Record<ComplaintReason, number>>;
  priority: 'high' | 'normal';
  open: boolean;
  cycleStartedAt: string;
  dueBy: string;
  lastReportedAt: string;
  hiddenAt?: string;
};

export async function reportConcern(value: unknown, uid: string) {
  const input = parsed(() => parseComplaint(value));
  const firestore = db();
  const { reportId } = input.target;
  const reporterHash = digest(uid);
  const day = new Date().toISOString().slice(0, 10);
  const quotaRef = firestore.collection('complaintDailyUsage').doc(digest(`${uid}|${day}`));
  await firestore.runTransaction(async (transaction) => {
    const state = await readTargetState(transaction, input.target);
    if (!state.publicIncident.exists)
      throw new HttpsError('not-found', 'This item is no longer public.');
    let storedIndex: number | undefined;
    if (input.target.type === 'photo') {
      storedIndex = photoOrder(state.incident!)[input.target.index];
      if (storedIndex === undefined)
        throw new HttpsError('not-found', 'This photo is no longer public.');
    }
    if (
      input.target.type === 'check' &&
      (state.publicCheck?.data()?.reportId !== reportId ||
        state.publicCheck.data()?.evidenceStatus !== 'published')
    )
      throw new HttpsError('not-found', 'These photos are no longer public.');
    const key = flagKey(input.target, storedIndex);
    const flagRef = firestore.collection('contentFlags').doc(key);
    const entryRef = firestore.collection('contentReports').doc(`${key}_${reporterHash}`);
    const [entry, flagSnapshot, quota] = await Promise.all([
      transaction.get(entryRef),
      transaction.get(flagRef),
      transaction.get(quotaRef),
    ]);
    if (entry.exists) return;
    const used = quota.data()?.count ?? 0;
    if (used >= DAILY_COMPLAINT_LIMIT)
      throw new HttpsError(
        'resource-exhausted',
        'Today’s limit for reporting content has been reached.',
      );
    const at = now();
    const previous = flagSnapshot.data() as FlagDoc | undefined;
    const reopening = !previous || !previous.open;
    const reasons = { ...(previous?.reasons ?? {}) };
    reasons[input.reason] = (reasons[input.reason] ?? 0) + 1;
    const flag: FlagDoc = {
      key,
      target: storedIndex === undefined ? input.target : { ...input.target, storedIndex },
      reportId,
      reference: state.incident!.reference,
      status: previous?.status ?? 'visible',
      reporters: (previous?.reporters ?? 0) + 1,
      baseline: previous?.baseline ?? 0,
      reasons,
      priority: complaintPriority(reasons),
      open: previous?.status !== 'removed',
      cycleStartedAt: reopening ? at : previous.cycleStartedAt,
      dueBy: reopening ? dueBy(at) : previous.dueBy,
      lastReportedAt: at,
      ...(previous?.hiddenAt ? { hiddenAt: previous.hiddenAt } : {}),
    };
    if (shouldAutoHide(flag)) {
      applyHide(transaction, flag, state, at);
      flag.status = 'auto-hidden';
      flag.hiddenAt = at;
    }
    transaction.set(flagRef, flag);
    transaction.set(entryRef, {
      key,
      reportId,
      reason: input.reason,
      ...(input.note ? { note: input.note } : {}),
      reporterHash,
      createdAt: at,
    });
    transaction.set(quotaRef, { count: used + 1, expiresAt: new Date(Date.now() + 2 * 86400000) });
  });
  return { received: true };
}

// ----- Hide, restore and remove effects. Every read happens before the first write.

type TargetState = {
  reportRef: FirebaseFirestore.DocumentReference;
  incidentRef: FirebaseFirestore.DocumentReference;
  publicRef: FirebaseFirestore.DocumentReference;
  report: DocumentData | undefined;
  incident: DocumentData | undefined;
  publicIncident: DocumentSnapshot;
  check?: DocumentSnapshot;
  publicCheck?: DocumentSnapshot;
};
async function readTargetState(transaction: Transaction, target: ComplaintTarget) {
  const firestore = db();
  const reportRef = firestore.collection('reports').doc(target.reportId);
  const incidentRef = firestore.collection('incidents').doc(target.reportId);
  const publicRef = firestore.collection('publicIncidents').doc(target.reportId);
  const [report, incident, publicIncident, check, publicCheck] = await Promise.all([
    transaction.get(reportRef),
    transaction.get(incidentRef),
    transaction.get(publicRef),
    target.type === 'check'
      ? transaction.get(firestore.collection('fieldChecks').doc(target.checkId))
      : Promise.resolve(undefined),
    target.type === 'check'
      ? transaction.get(firestore.collection('publicFieldChecks').doc(target.checkId))
      : Promise.resolve(undefined),
  ]);
  return {
    reportRef,
    incidentRef,
    publicRef,
    report: report.data(),
    incident: incident.data(),
    publicIncident,
    ...(check ? { check } : {}),
    ...(publicCheck ? { publicCheck } : {}),
  } satisfies TargetState;
}

function republish(transaction: Transaction, state: TargetState, incident: DocumentData) {
  // A hidden or removed issue never regains its projection through a photo or check change.
  if (incident.moderationHold || incident.publicationStatus !== 'published') return;
  const projection = toPublicIncident(incident as IncidentRecord);
  if (projection) transaction.set(state.publicRef, projection);
}

function applyHide(transaction: Transaction, flag: FlagDoc, state: TargetState, at: string) {
  const target = flag.target;
  if (target.type === 'issue') {
    const hold = { status: 'hidden', since: at };
    transaction.delete(state.publicRef);
    transaction.update(state.incidentRef, { moderationHold: hold });
    if (state.report) transaction.update(state.reportRef, { moderationHold: hold });
    return;
  }
  if (target.type === 'photo') {
    const incident = state.incident!;
    const order = photoOrder(incident).filter((index) => index !== target.storedIndex);
    const updated = {
      ...incident,
      storedPhotoCount: storedCount(incident),
      photoOrder: order,
      hiddenPhotos: [...new Set([...(incident.hiddenPhotos ?? []), target.storedIndex])],
      photoCount: order.length,
      publicationVersion: incident.publicationVersion + 1,
    };
    transaction.update(state.incidentRef, {
      storedPhotoCount: updated.storedPhotoCount,
      photoOrder: updated.photoOrder,
      hiddenPhotos: updated.hiddenPhotos,
      photoCount: updated.photoCount,
      publicationVersion: updated.publicationVersion,
    });
    republish(transaction, state, updated);
    return;
  }
  transaction.update(state.publicCheck!.ref, { evidenceStatus: 'private', photoCount: 0 });
  transaction.update(state.check!.ref, { moderationHold: { status: 'hidden', since: at } });
}

function applyRestore(transaction: Transaction, flag: FlagDoc, state: TargetState) {
  const target = flag.target;
  if (target.type === 'issue') {
    if (!state.incident) return;
    const incident = { ...state.incident };
    delete incident.moderationHold;
    transaction.update(state.incidentRef, { moderationHold: FieldValue.delete() });
    if (state.report) transaction.update(state.reportRef, { moderationHold: FieldValue.delete() });
    republish(transaction, state, incident);
    return;
  }
  if (target.type === 'photo') {
    const incident = state.incident!;
    const hidden = (incident.hiddenPhotos ?? []) as number[];
    if (!hidden.includes(target.storedIndex!)) return;
    const order = [...photoOrder(incident), target.storedIndex!].sort((a, b) => a - b);
    const updated = {
      ...incident,
      photoOrder: order,
      hiddenPhotos: hidden.filter((index) => index !== target.storedIndex),
      photoCount: order.length,
      publicationVersion: incident.publicationVersion + 1,
    };
    transaction.update(state.incidentRef, {
      photoOrder: updated.photoOrder,
      hiddenPhotos: updated.hiddenPhotos,
      photoCount: updated.photoCount,
      publicationVersion: updated.publicationVersion,
    });
    republish(transaction, state, updated);
    return;
  }
  const check = state.check?.data();
  if (!check || check.evidenceStatus !== 'published') return;
  transaction.update(state.publicCheck!.ref, {
    evidenceStatus: 'published',
    photoCount: check.photoCount ?? 0,
  });
  transaction.update(state.check!.ref, { moderationHold: FieldValue.delete() });
}

/** Permanent removal. Returns the public derivatives to delete after the transaction commits. */
function applyRemove(transaction: Transaction, flag: FlagDoc, state: TargetState, at: string) {
  const target = flag.target;
  const id = target.reportId;
  const hold = { status: 'removed', since: at };
  if (target.type === 'issue') {
    if (!state.incident) return [];
    transaction.delete(state.publicRef);
    transaction.update(state.incidentRef, { moderationHold: hold, publicationStatus: 'hidden' });
    if (state.report)
      transaction.update(state.reportRef, {
        moderationHold: hold,
        publicationStatus: 'hidden',
        moderationStatus: 'rejected',
      });
    const incident = state.incident;
    return [
      ...Array.from(
        { length: storedCount(incident) },
        (_, index) => `public/incidents/${id}/${index}.jpg`,
      ),
      ...(typeof incident.resolutionMediaBatchId === 'string' &&
      UUID_PATTERN.test(incident.resolutionMediaBatchId)
        ? Array.from(
            { length: readResolution(incident.resolution)?.photoCount ?? 0 },
            (_, index) =>
              `public/incidents/${id}/resolution/${incident.resolutionMediaBatchId}/${index}.jpg`,
          )
        : []),
    ];
  }
  if (target.type === 'photo') {
    const incident = state.incident!;
    const order = photoOrder(incident).filter((index) => index !== target.storedIndex);
    const updated = {
      ...incident,
      storedPhotoCount: storedCount(incident),
      photoOrder: order,
      hiddenPhotos: ((incident.hiddenPhotos ?? []) as number[]).filter(
        (index) => index !== target.storedIndex,
      ),
      removedPhotos: [...new Set([...(incident.removedPhotos ?? []), target.storedIndex])],
      photoCount: order.length,
      publicationVersion: incident.publicationVersion + 1,
    };
    transaction.update(state.incidentRef, {
      storedPhotoCount: updated.storedPhotoCount,
      photoOrder: updated.photoOrder,
      hiddenPhotos: updated.hiddenPhotos,
      removedPhotos: updated.removedPhotos,
      photoCount: updated.photoCount,
      publicationVersion: updated.publicationVersion,
    });
    republish(transaction, state, updated);
    return [`public/incidents/${id}/${target.storedIndex}.jpg`];
  }
  const check = state.check?.data();
  if (!check) return [];
  transaction.update(state.publicCheck!.ref, { evidenceStatus: 'private', photoCount: 0 });
  transaction.update(state.check!.ref, {
    moderationHold: hold,
    evidenceStatus: 'private',
    photoCount: 0,
    reviewMediaBatchId: null,
  });
  return typeof check.reviewMediaBatchId === 'string' && UUID_PATTERN.test(check.reviewMediaBatchId)
    ? Array.from(
        { length: check.photoCount ?? 0 },
        (_, index) =>
          `public/incidents/${id}/field-checks/${target.checkId}/${check.reviewMediaBatchId}/${index}.jpg`,
      )
    : [];
}

// ----- Operators

type StaffAuth = NonNullable<CallableRequest['auth']>;
async function assertStaff(auth: StaffAuth) {
  const member = (await db().collection('staffMembers').doc(auth.uid).get()).data();
  if (
    auth.token.email_verified !== true ||
    auth.token.firebase?.sign_in_provider !== 'password' ||
    member?.active !== true ||
    member.role !== 'moderator'
  )
    throw new HttpsError('permission-denied', 'This account is not an active Civic263 operator.');
  return { email: String(member.email ?? auth.token.email ?? ''), role: member.role as string };
}
function audit(transaction: Transaction, entry: Record<string, unknown>) {
  transaction.create(db().collection('moderationAudit').doc(), { ...entry, at: now() });
}
async function readObject(path: string) {
  try {
    const [bytes] = await getStorage().bucket().file(path).download();
    return bytes.toString('base64');
  } catch {
    return null;
  }
}
const byOldest = (field: string) => (left: DocumentData, right: DocumentData) =>
  String(left[field]).localeCompare(String(right[field]));

export async function runStaffCommand(value: unknown, auth: StaffAuth) {
  const operator = await assertStaff(auth);
  const command = parsed(() => parseStaffCommand(value));
  const firestore = db();
  if (command.action === 'staff-profile')
    return { ...operator, automaticReview: await automaticReviewEnabled() };
  if (command.action === 'staff-queue') {
    if (command.queue === 'appeals') {
      const page = await firestore
        .collection('appeals')
        .where('status', '==', 'open')
        .limit(200)
        .get();
      return { items: page.docs.map((doc) => doc.data()).sort(byOldest('requestedAt')) };
    }
    if (command.queue === 'complaints') {
      const page = await firestore
        .collection('contentFlags')
        .where('open', '==', true)
        .limit(200)
        .get();
      const items = page.docs.map((doc) => doc.data());
      // Personal information and danger first, then the oldest deadline.
      items.sort(
        (left, right) =>
          Number(left.priority !== 'high') - Number(right.priority !== 'high') ||
          String(left.dueBy).localeCompare(String(right.dueBy)),
      );
      return { items };
    }
    if (command.queue === 'blocks') {
      const page = await firestore.collection('residentBlocks').limit(200).get();
      return {
        items: page.docs
          .map((doc) => ({ blockId: doc.id, ...doc.data() }))
          .sort(byOldest('blockedAt'))
          .reverse(),
      };
    }
    const page = await firestore
      .collection('reports')
      .where('reviewStatus', '==', 'held')
      .where('publicationStatus', '==', 'hidden')
      .where('moderationStatus', '==', 'pending')
      .limit(200)
      .get();
    const items = page.docs
      .filter((doc) => doc.data().receipt?.testOnly !== true)
      .map((doc) => {
        const item = doc.data();
        const waiting = awaitingStaffReview({
          moderationStatus: item.moderationStatus,
          publicationStatus: item.publicationStatus,
          reviewStatus: item.reviewStatus,
          reviewReason: item.reviewReason ?? null,
          staffDecision: item.staffDecision ?? null,
        });
        return {
          reportId: doc.id,
          reference: item.receipt.reference,
          categoryId: item.categoryId,
          reviewReason: item.reviewReason ?? null,
          createdAt: item.createdAt,
          appeal: item.appeal ?? null,
          staffDecision: item.staffDecision ?? null,
          photoCount: (item.rawMediaPaths ?? []).length,
          // Reports that no automatic check has seen carry the same response target as appeals.
          dueBy: waiting ? dueBy(item.createdAt) : null,
        };
      });
    // Reports waiting for a person first, then everything else, oldest first.
    items.sort(
      (left, right) =>
        Number(!left.dueBy) - Number(!right.dueBy) ||
        String(left.createdAt).localeCompare(String(right.createdAt)),
    );
    return { items };
  }
  if (command.action === 'staff-report') return readStaffReport(command.reportId);
  if (command.action === 'staff-publish') return staffPublish(command, auth.uid);
  if (command.action === 'staff-keep-private') {
    const ref = firestore.collection('reports').doc(command.reportId);
    return firestore.runTransaction(async (transaction) => {
      const report = (await transaction.get(ref)).data();
      if (
        report &&
        report.appeal?.status !== 'open' &&
        awaitingStaffReview({
          moderationStatus: report.moderationStatus,
          publicationStatus: report.publicationStatus,
          reviewStatus: report.reviewStatus,
          reviewReason: report.reviewReason ?? null,
          staffDecision: report.staffDecision ?? null,
        })
      ) {
        // Automatic review was off, so this is the first decision anyone has made on it.
        const staffDecision: StaffDecision = {
          status: 'kept-private',
          decidedAt: now(),
          reason: command.reason,
          ...(command.note ? { note: command.note } : {}),
        };
        transaction.update(ref, { staffDecision });
        audit(transaction, {
          action: 'keep-private',
          reportId: command.reportId,
          reason: command.reason,
          staffUid: auth.uid,
        });
        return { staffDecision };
      }
      if (!report || report.appeal?.status !== 'open')
        throw new HttpsError(
          'failed-precondition',
          'This report has no open appeal and is not waiting for a person.',
        );
      const appeal: ResidentAppeal = {
        ...(report.appeal as ResidentAppeal),
        status: 'kept-private',
        decidedAt: now(),
        reason: command.reason,
        ...(command.note ? { note: command.note } : {}),
      };
      transaction.update(ref, { appeal });
      transaction.update(firestore.collection('appeals').doc(command.reportId), {
        status: 'kept-private',
        decidedAt: appeal.decidedAt,
        reason: command.reason,
      });
      audit(transaction, {
        action: 'keep-private',
        reportId: command.reportId,
        reason: command.reason,
        staffUid: auth.uid,
      });
      return { appeal };
    });
  }
  if (command.action === 'staff-resolve-complaint') {
    const flagRef = firestore.collection('contentFlags').doc(command.key);
    const remove = await firestore.runTransaction(async (transaction) => {
      const flag = (await transaction.get(flagRef)).data() as FlagDoc | undefined;
      if (!flag || !flag.open)
        throw new HttpsError('failed-precondition', 'This complaint has already been decided.');
      const state = await readTargetState(transaction, flag.target);
      const at = now();
      let paths: string[] = [];
      if (command.outcome === 'restore') {
        if (flag.status === 'auto-hidden') applyRestore(transaction, flag, state);
      } else paths = applyRemove(transaction, flag, state, at);
      transaction.update(flagRef, {
        status: command.outcome === 'restore' ? 'restored' : 'removed',
        open: false,
        baseline: flag.reporters,
        decidedAt: at,
      });
      audit(transaction, {
        action: `complaint-${command.outcome}`,
        key: command.key,
        reportId: flag.reportId,
        staffUid: auth.uid,
        ...(command.note ? { note: command.note } : {}),
      });
      return paths;
    });
    await deleteDerivatives(remove);
    return { key: command.key, status: command.outcome === 'restore' ? 'restored' : 'removed' };
  }
  if (command.action === 'staff-block') {
    const report = (await firestore.collection('reports').doc(command.reportId).get()).data();
    const check = command.checkId
      ? (await firestore.collection('fieldChecks').doc(command.checkId).get()).data()
      : undefined;
    const uid = command.checkId
      ? check?.reportId === command.reportId
        ? check.actorUid
        : undefined
      : report?.ownerUid;
    if (typeof uid !== 'string' || uid === 'erased-resident')
      throw new HttpsError('failed-precondition', 'This contributor’s account no longer exists.');
    const id = blockId(uid);
    await firestore.runTransaction(async (transaction) => {
      transaction.set(firestore.collection('residentBlocks').doc(id), {
        blockedAt: now(),
        note: command.note,
        source: {
          reference: report?.receipt?.reference ?? null,
          kind: command.checkId ? 'community-check' : 'report',
        },
        staffUid: auth.uid,
      });
      audit(transaction, {
        action: 'block',
        blockId: id,
        reportId: command.reportId,
        staffUid: auth.uid,
        note: command.note,
      });
    });
    return { blockId: id };
  }
  const blockRef = firestore.collection('residentBlocks').doc(command.blockId);
  await firestore.runTransaction(async (transaction) => {
    if (!(await transaction.get(blockRef)).exists)
      throw new HttpsError('not-found', 'This identity is not blocked.');
    transaction.delete(blockRef);
    audit(transaction, {
      action: 'unblock',
      blockId: command.blockId,
      staffUid: auth.uid,
      note: command.note,
    });
  });
  return { blockId: command.blockId, unblocked: true };
}

async function deleteDerivatives(paths: string[]) {
  const bucket = getStorage().bucket();
  await Promise.all(paths.map((path) => bucket.file(path).delete({ ignoreNotFound: true }))).catch(
    () => logError('Removed public derivatives remain', { count: paths.length }),
  );
}

async function readStaffReport(reportId: string) {
  const firestore = db();
  const [snapshot, incidentSnapshot, appealSnapshot, flags, complaints] = await Promise.all([
    firestore.collection('reports').doc(reportId).get(),
    firestore.collection('incidents').doc(reportId).get(),
    firestore.collection('appeals').doc(reportId).get(),
    firestore.collection('contentFlags').where('reportId', '==', reportId).get(),
    firestore.collection('contentReports').where('reportId', '==', reportId).limit(100).get(),
  ]);
  const report = snapshot.data();
  if (!report) throw new HttpsError('not-found', 'Report not found.');
  const originals = [];
  for (const path of (report.rawMediaPaths ?? []) as string[])
    originals.push(path.startsWith('private/reports/') ? await readObject(path) : null);
  const incident = incidentSnapshot.data();
  const published = incident?.title
    ? {
        title: incident.title,
        summary: incident.summary,
        area: incident.area,
        reviewMethod: incident.reviewMethod ?? 'automated',
        publicationStatus: incident.publicationStatus,
        moderationHold: incident.moderationHold ?? null,
        photos: await Promise.all(
          Array.from({ length: storedCount(incident) }, async (_, index) => ({
            storedIndex: index,
            hidden: ((incident.hiddenPhotos ?? []) as number[]).includes(index),
            removed: ((incident.removedPhotos ?? []) as number[]).includes(index),
            base64: ((incident.removedPhotos ?? []) as number[]).includes(index)
              ? null
              : await readObject(`public/incidents/${reportId}/${index}.jpg`),
          })),
        ),
      }
    : null;
  const flaggedChecks = flags.docs
    .map((doc) => doc.data() as FlagDoc)
    .filter((flag) => flag.target.type === 'check');
  const checks = [];
  for (const flag of flaggedChecks) {
    const checkId = (flag.target as { checkId: string }).checkId;
    const check = (await firestore.collection('fieldChecks').doc(checkId).get()).data();
    if (!check) continue;
    const batch = check.reviewMediaBatchId;
    checks.push({
      checkId,
      kind: check.kind,
      createdAt: check.createdAt,
      photos:
        typeof batch === 'string' && UUID_PATTERN.test(batch)
          ? await Promise.all(
              Array.from({ length: check.photoCount ?? 0 }, (_, index) =>
                readObject(
                  `public/incidents/${reportId}/field-checks/${checkId}/${batch}/${index}.jpg`,
                ),
              ),
            )
          : [],
    });
  }
  return {
    reportId,
    reference: report.receipt?.reference,
    categoryId: report.categoryId,
    description: report.description ?? '',
    landmark: report.landmark ?? '',
    location: report.location ?? null,
    createdAt: report.createdAt,
    moderationStatus: report.moderationStatus,
    publicationStatus: report.publicationStatus,
    reviewStatus: report.reviewStatus,
    reviewReason: report.reviewReason ?? null,
    staffDecision: report.staffDecision ?? null,
    dueBy:
      report.receipt?.testOnly !== true &&
      awaitingStaffReview({
        moderationStatus: report.moderationStatus,
        publicationStatus: report.publicationStatus,
        reviewStatus: report.reviewStatus,
        reviewReason: report.reviewReason ?? null,
        staffDecision: report.staffDecision ?? null,
      })
        ? dueBy(report.createdAt)
        : null,
    withdrawn: report.moderationStatus === 'withdrawn',
    ownerErased: !report.ownerUid,
    originals,
    appeal: appealSnapshot.data() ?? null,
    published,
    flags: flags.docs.map((doc) => doc.data()),
    // Complaint text only; reporter identities stay hashed and are never returned.
    complaints: complaints.docs.map((doc) => ({
      key: doc.data().key,
      reason: doc.data().reason as ComplaintReason,
      reasonLabel: COMPLAINT_REASONS[doc.data().reason as ComplaintReason] ?? 'Other',
      note: doc.data().note ?? null,
      createdAt: doc.data().createdAt,
    })),
    checks,
    keepPrivateReasons: KEEP_PRIVATE_LABELS,
  };
}

async function staffPublish(
  command: Extract<ReturnType<typeof parseStaffCommand>, { action: 'staff-publish' }>,
  staffUid: string,
) {
  const firestore = db();
  const ref = firestore.collection('reports').doc(command.reportId);
  const before = (await ref.get()).data();
  const eligible = (report: DocumentData | undefined) =>
    !!report &&
    report.moderationStatus === 'pending' &&
    report.publicationStatus === 'hidden' &&
    report.reviewStatus === 'held' &&
    report.workflowStatus === 'received' &&
    report.receipt?.testOnly !== true;
  if (!eligible(before))
    throw new HttpsError(
      'failed-precondition',
      'Only a held, unpublished report can be published.',
    );
  const originals = (before!.rawMediaPaths ?? []) as string[];
  if (command.photos.some((index) => index >= originals.length))
    throw new HttpsError('invalid-argument', 'Choose which photos to publish.');
  // The operator chose these photos; they are re-encoded like automated derivatives.
  const bucket = getStorage().bucket();
  const written: string[] = [];
  try {
    for (const [publicIndex, source] of command.photos.entries()) {
      const [bytes] = await bucket.file(originals[source]!).download();
      const path = `public/incidents/${command.reportId}/${publicIndex}.jpg`;
      await bucket
        .file(path)
        .save(
          await sharp(bytes)
            .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer(),
          {
            resumable: false,
            metadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' },
          },
        );
      written.push(path);
    }
    return await firestore.runTransaction(async (transaction) => {
      const report = (await transaction.get(ref)).data();
      if (
        !eligible(report) ||
        JSON.stringify(report!.rawMediaPaths) !== JSON.stringify(originals) ||
        report!.revision !== before!.revision
      )
        throw new HttpsError(
          'failed-precondition',
          'This report changed. Reload it before deciding.',
        );
      const at = now();
      const incident = buildIncident(
        command.reportId,
        report as never,
        command,
        command.photos.length,
        'staff',
        at,
      );
      transaction.create(firestore.collection('incidents').doc(command.reportId), incident);
      transaction.create(
        firestore.collection('publicIncidents').doc(command.reportId),
        toPublicIncident(incident)!,
      );
      const appeal = report!.appeal
        ? { ...(report!.appeal as ResidentAppeal), status: 'published' as const, decidedAt: at }
        : null;
      transaction.update(ref, {
        reviewStatus: 'published',
        reviewReason: null,
        moderationStatus: 'approved',
        publicationStatus: 'published',
        approvedPhotoIndexes: command.photos,
        reviewedAt: at,
        reviewPolicy: 'civic263-staff-review-v1',
        // An earlier keep-private decision no longer describes a published report.
        staffDecision: FieldValue.delete(),
        ...(appeal ? { appeal } : {}),
      });
      if (appeal)
        transaction.update(firestore.collection('appeals').doc(command.reportId), {
          status: 'published',
          decidedAt: at,
        });
      audit(transaction, {
        action: 'publish',
        reportId: command.reportId,
        photos: command.photos.length,
        staffUid,
      });
      return { reportId: command.reportId, published: true };
    });
  } catch (reason) {
    await deleteDerivatives(written);
    if (reason instanceof HttpsError) throw reason;
    logError('Operator publication could not finish', { reportId: command.reportId });
    throw new HttpsError(
      'unavailable',
      'Publication did not finish. Nothing was published; retry.',
    );
  }
}
