import { createHash, randomUUID } from 'node:crypto';
import { getFirestore, type DocumentData } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  parseCommunityCheck,
  checkCommunityTransition,
  readCommunityResolution,
  type CommunityCheckCommand,
  type CommunityReceipt,
  type CommunityResolution,
} from '../../packages/domain/src/community.ts';
import { checkResolutionEvidence } from '../../packages/domain/src/report-resolution.ts';
import { toPublicIncident } from '../../packages/domain/src/publication.ts';
import type { IncidentRecord, WorkflowStatus } from '../../packages/domain/src/models.ts';
import { validatePhotos } from './report-intake.ts';
import { verifyOnSite } from './community.ts';

function validateState(
  command: CommunityCheckCommand,
  report: DocumentData,
  uid: string,
  reviewer: boolean,
  testIdentity: boolean,
) {
  if (testIdentity && report.receipt?.testOnly !== true)
    throw new HttpsError('permission-denied', 'Test identities cannot change genuine issues.');
  try {
    checkCommunityTransition({
      action: command.action,
      workflowStatus: report.workflowStatus,
      current: readCommunityResolution(report.communityResolution),
      actorUid: uid,
      proposerUid: report.activeFixProposerUid,
      reviewer,
      ...(command.fixId ? { fixId: command.fixId } : {}),
    });
    verifyOnSite(command.location, report, uid);
    checkResolutionEvidence(command, report.location);
  } catch (reason) {
    if (reason instanceof HttpsError) throw reason;
    const message =
      reason instanceof Error ? reason.message : 'Check the latest issue and your site evidence.';
    throw new HttpsError(
      'failed-precondition',
      uid !== report.ownerUid && message.startsWith('You are ')
        ? 'Take the photos within 20 metres of the actual defect site. The public pin is approximate.'
        : message,
    );
  }
}
export async function submitFieldCheck(
  value: unknown,
  uid: string,
  testIdentity = false,
): Promise<CommunityReceipt> {
  let command: CommunityCheckCommand;
  try {
    command = parseCommunityCheck(value);
  } catch (reason) {
    throw new HttpsError(
      'invalid-argument',
      reason instanceof Error ? reason.message : 'Invalid field check.',
    );
  }
  const db = getFirestore();
  const id = createHash('sha256').update(`${uid}\0${command.attemptId}`).digest('hex').slice(0, 40);
  const hash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
  const lease = randomUUID();
  const reservation = db.collection('fieldCheckSubmissions').doc(id);
  const reportRef = db.collection('reports').doc(command.reportId);
  const incidentRef = db.collection('incidents').doc(command.reportId);
  const publicRef = db.collection('publicIncidents').doc(command.reportId);
  const profileRef = db.collection('residentCommunity').doc(uid);
  const readState = async (transaction: FirebaseFirestore.Transaction) => {
    const [raw, canonical, published, profile] = await Promise.all([
      transaction.get(reportRef),
      transaction.get(incidentRef),
      transaction.get(publicRef),
      transaction.get(profileRef),
    ]);
    const report = raw.data();
    const incident = canonical.data() as IncidentRecord | undefined;
    if (
      !report ||
      !incident ||
      report.publicationStatus !== 'published' ||
      incident.publicationStatus !== 'published' ||
      incident.id !== command.reportId ||
      published.data()?.id !== command.reportId ||
      incident.reference !== report.receipt?.reference ||
      published.data()?.reference !== incident.reference
    )
      throw new HttpsError(
        'not-found',
        'Community reviewing is available for published issues only.',
      );
    if (
      incident.workflowStatus !== report.workflowStatus ||
      incident.communityResolution?.fixId !== report.communityResolution?.fixId ||
      published.data()?.communityResolution?.fixId !== report.communityResolution?.fixId ||
      (command.action !== 'report-fix' && typeof report.activeFixProposerUid !== 'string')
    )
      throw new HttpsError(
        'failed-precondition',
        'The linked issue changed. Refresh before reviewing.',
      );
    validateState(
      command,
      report,
      uid,
      profile.data()?.preferences?.reviewer === true,
      testIdentity,
    );
    return { report, incident };
  };
  const receipt = await db.runTransaction(async (transaction) => {
    const current = (await transaction.get(reservation)).data();
    if (current?.actorUid !== undefined && current.actorUid !== uid)
      throw new HttpsError('not-found', 'Visit not found.');
    if (current?.payloadHash && current.payloadHash !== hash)
      throw new HttpsError('already-exists', 'This visit already has different saved evidence.');
    if (current?.receipt) return current.receipt as CommunityReceipt;
    await readState(transaction);
    if (current?.leaseUntil > Date.now())
      throw new HttpsError('aborted', 'This visit is still uploading. Retry shortly.');
    const quota = db.collection('fieldCheckDailyUsage').doc(
      createHash('sha256')
        .update(`${uid}|${new Date().toISOString().slice(0, 10)}`)
        .digest('hex'),
    );
    if (!current) {
      const count = (await transaction.get(quota)).data()?.count ?? 0;
      if (count >= 20)
        throw new HttpsError(
          'resource-exhausted',
          'Today’s community visit limit has been reached.',
        );
      transaction.set(quota, { count: count + 1, expiresAt: new Date(Date.now() + 2 * 86400000) });
    }
    transaction.set(
      reservation,
      { actorUid: uid, payloadHash: hash, lease, leaseUntil: Date.now() + 120000 },
      { merge: true },
    );
    return null;
  });
  if (receipt) return receipt;
  try {
    const photos = await validatePhotos(command);
    const paths: string[] = [];
    for (const photo of photos) {
      const path = `private/reports/${uid}/${command.reportId}/field-checks/${id}/${lease}/${photo.id}.jpg`;
      await getStorage()
        .bucket()
        .file(path)
        .save(photo.bytes, {
          resumable: false,
          metadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' },
        });
      paths.push(path);
    }
    return await db.runTransaction(async (transaction) => {
      const current = (await transaction.get(reservation)).data();
      if (current?.receipt) return current.receipt as CommunityReceipt;
      if (current?.lease !== lease || current.leaseUntil < Date.now())
        throw new HttpsError('aborted', 'The upload expired. Check your visit and retry.');
      const { report, incident } = await readState(transaction);
      const now = new Date().toISOString();
      const previous = readCommunityResolution(report.communityResolution);
      const communityResolution: CommunityResolution =
        command.action === 'report-fix'
          ? { status: 'awaiting-confirmation', fixId: id, reportedFixedAt: now }
          : {
              ...previous!,
              status: command.action === 'confirm-fix' ? 'confirmed' : 'not-fixed',
              reviewedAt: now,
            };
      const workflowStatus: WorkflowStatus =
        command.action === 'report-fix'
          ? 'resolution-pending'
          : command.action === 'confirm-fix'
            ? 'resolved'
            : (report.preFixWorkflowStatus ?? 'received');
      const result: CommunityReceipt = {
        reportId: command.reportId,
        checkId: id,
        workflowStatus,
        communityResolution,
      };
      const updates = {
        workflowStatus,
        communityResolution,
        ...(command.action === 'report-fix'
          ? { activeFixProposerUid: uid, preFixWorkflowStatus: report.workflowStatus }
          : {}),
      };
      transaction.update(reportRef, updates);
      const updated = {
        ...incident,
        workflowStatus,
        communityResolution,
        publicationVersion: incident.publicationVersion + 1,
      };
      transaction.update(incidentRef, {
        ...updates,
        publicationVersion: updated.publicationVersion,
      });
      transaction.set(publicRef, toPublicIncident(updated)!);
      const entry = {
        id,
        reportId: command.reportId,
        reference: incident.reference,
        kind: command.action,
        actorUid: uid,
        fixId: command.fixId ?? id,
        createdAt: now,
        rawMediaPaths: paths,
        location: command.location,
        captures: command.photos.map(({ id, capturedAt, captureSource, location }) => ({
          id,
          capturedAt,
          captureSource,
          location,
        })),
        evidenceStatus: 'pending',
        photoCount: 0,
        testOnly: testIdentity || report.receipt.testOnly === true,
        categoryId: incident.categoryId,
        description: incident.summary,
        landmark: incident.area,
      };
      transaction.create(db.collection('fieldChecks').doc(id), entry);
      transaction.create(db.collection('publicFieldChecks').doc(id), {
        id,
        reportId: command.reportId,
        kind: command.action,
        createdAt: now,
        evidenceStatus: 'pending',
        photoCount: 0,
      });
      const recipients = [
        ...new Set<string>([
          report.ownerUid,
          ...(command.action === 'report-fix' ? [] : [report.activeFixProposerUid]),
        ]),
      ];
      for (const recipient of recipients)
        transaction.create(
          db.collection('residentNotifications').doc(recipient).collection('items').doc(id),
          {
            reportId: command.reportId,
            reference: incident.reference,
            kind: command.action,
            createdAt: now,
            readAt: null,
            pushStatus: 'queued',
          },
        );
      transaction.create(db.collection('reportEvents').doc(`${id}_community`), {
        event: 'community-field-check',
        checkId: id,
        reportId: command.reportId,
        actorUid: uid,
        occurredAt: now,
        notificationUids: recipients,
      });
      transaction.update(reservation, { receipt: result, leaseUntil: 0 });
      return result;
    });
  } catch (reason) {
    await db
      .runTransaction(async (transaction) => {
        const current = (await transaction.get(reservation)).data();
        if (current?.lease === lease && !current.receipt)
          transaction.update(reservation, { leaseUntil: 0 });
      })
      .catch(() => {});
    if (reason instanceof HttpsError) throw reason;
    throw new HttpsError(
      'unavailable',
      'Could not confirm this visit. Your saved evidence can be retried.',
    );
  }
}
