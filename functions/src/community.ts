import { createHash } from 'node:crypto';
import { FieldPath, getFirestore, type DocumentData } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  COMMUNITY_ID,
  DEFAULT_COMMUNITY_PREFERENCES,
  parseCommunityPreferences,
  readCommunityResolution,
} from '../../packages/domain/src/community.ts';
import {
  parseResolutionFix,
  checkResolutionPosition,
} from '../../packages/domain/src/report-resolution.ts';
import { UUID_PATTERN } from '../../packages/domain/src/report-submission.ts';

export function exactCommand(value: unknown, keys: string[]) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !['action', ...keys].includes(key))
  )
    throw new HttpsError('invalid-argument', 'Invalid community request.');
  return value as Record<string, unknown>;
}
export function communityId(value: unknown) {
  if (typeof value !== 'string' || !COMMUNITY_ID.test(value))
    throw new HttpsError('invalid-argument', 'Choose a valid issue or visit.');
  return value;
}
export function publicFieldCheck(data: DocumentData) {
  return {
    id: data.id as string,
    kind: data.kind,
    createdAt: data.createdAt,
    evidenceStatus: ['pending', 'published', 'private'].includes(data.evidenceStatus)
      ? data.evidenceStatus
      : 'private',
    photoCount:
      data.evidenceStatus === 'published' &&
      Number.isInteger(data.photoCount) &&
      data.photoCount >= 0 &&
      data.photoCount <= 3
        ? data.photoCount
        : 0,
  };
}
export function verifyOnSite(location: unknown, report: DocumentData, uid: string) {
  try {
    checkResolutionPosition(parseResolutionFix(location), report.location);
  } catch (reason) {
    const message =
      reason instanceof Error ? reason.message : 'Check your location at the defect site.';
    // Do not turn the public review command into an oracle for an owner's precise private pin.
    throw new HttpsError(
      'failed-precondition',
      uid !== report.ownerUid && message.startsWith('You are ')
        ? 'Move within 20 metres of the actual defect site and try again. The public map pin is approximate.'
        : message,
    );
  }
}
export async function communityCommand(value: unknown, uid: string, testIdentity = false) {
  const action = (value as { action?: unknown })?.action;
  const db = getFirestore();
  const profileRef = db.collection('residentCommunity').doc(uid);
  if (action === 'community-profile') {
    exactCommand(value, []);
    return {
      preferences: (await profileRef.get()).data()?.preferences ?? DEFAULT_COMMUNITY_PREFERENCES,
      ...(testIdentity ? { testIdentity: true } : {}),
    };
  }
  if (action === 'community-preferences') {
    const data = exactCommand(value, ['preferences']);
    let preferences;
    try {
      preferences = parseCommunityPreferences(data.preferences);
    } catch {
      throw new HttpsError('invalid-argument', 'Choose valid review preferences.');
    }
    await profileRef.set({ preferences, updatedAt: new Date().toISOString() });
    return { preferences };
  }
  if (action === 'community-context') {
    const data = exactCommand(value, ['reportId', 'location']);
    const id = communityId(data.reportId);
    if (data.location !== undefined) {
      const quota = db.collection('communityPositionUsage').doc(
        createHash('sha256')
          .update(`${uid}|${new Date().toISOString().slice(0, 10)}`)
          .digest('hex'),
      );
      await db.runTransaction(async (transaction) => {
        const count = (await transaction.get(quota)).data()?.count ?? 0;
        if (count >= 120)
          throw new HttpsError('resource-exhausted', 'Today’s site-check limit has been reached.');
        transaction.set(quota, {
          count: count + 1,
          expiresAt: new Date(Date.now() + 2 * 86400000),
        });
      });
    }
    const [snapshot, published, profile] = await Promise.all([
      db.collection('reports').doc(id).get(),
      db.collection('publicIncidents').doc(id).get(),
      profileRef.get(),
    ]);
    const report = snapshot.data();
    if (!report || report.publicationStatus !== 'published' || published.data()?.id !== id)
      throw new HttpsError(
        'not-found',
        'Community reviewing is available for published issues only.',
      );
    if (data.location !== undefined) verifyOnSite(data.location, report, uid);
    const current = readCommunityResolution(report.communityResolution);
    return {
      onSite: data.location !== undefined,
      hasSite: !!report.location,
      canReportFix: ![
        'resolved',
        'closed',
        'merged',
        'out-of-scope',
        'resolution-pending',
      ].includes(report.workflowStatus),
      canReview:
        report.workflowStatus === 'resolution-pending' &&
        current?.status === 'awaiting-confirmation' &&
        report.activeFixProposerUid !== uid &&
        profile.data()?.preferences?.reviewer === true,
      ownProposal: report.activeFixProposerUid === uid,
      reviewer: profile.data()?.preferences?.reviewer === true,
      communityResolution: current,
    };
  }
  if (action === 'community-inbox' || action === 'community-visits') {
    const data = exactCommand(value, ['cursor']);
    const visits = action === 'community-visits';
    let query = visits
      ? db
          .collection('fieldChecks')
          .where('actorUid', '==', uid)
          .orderBy('createdAt', 'desc')
          .orderBy(FieldPath.documentId())
          .limit(21)
      : db
          .collection('residentNotifications')
          .doc(uid)
          .collection('items')
          .orderBy('createdAt', 'desc')
          .orderBy(FieldPath.documentId())
          .limit(21);
    if (data.cursor !== undefined) {
      const cursor = communityId(data.cursor);
      const after = await (
        visits
          ? db.collection('fieldChecks')
          : db.collection('residentNotifications').doc(uid).collection('items')
      )
        .doc(cursor)
        .get();
      if (!after.exists || (visits && after.data()?.actorUid !== uid))
        throw new HttpsError('not-found', 'Visit not found.');
      query = query.startAfter(after);
    }
    const result = await query.get();
    const items = result.docs.slice(0, 20).map((snapshot) => {
      const item = snapshot.data();
      return visits
        ? {
            ...publicFieldCheck({ ...item, id: snapshot.id }),
            reportId: item.reportId,
            reference: item.reference,
            ownPhotoCount: item.rawMediaPaths.length,
          }
        : {
            id: snapshot.id,
            reportId: item.reportId,
            reference: item.reference,
            kind: item.kind,
            createdAt: item.createdAt,
            readAt: item.readAt ?? null,
          };
    });
    return { items, nextCursor: result.size > 20 ? result.docs[19]!.id : null };
  }
  if (action === 'community-read') {
    const data = exactCommand(value, ['notificationId']);
    const ref = db
      .collection('residentNotifications')
      .doc(uid)
      .collection('items')
      .doc(communityId(data.notificationId));
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new HttpsError('not-found', 'Notification not found.');
      if (!snapshot.data()?.readAt) transaction.update(ref, { readAt: new Date().toISOString() });
    });
    return { read: true };
  }
  if (action === 'community-visit') {
    const data = exactCommand(value, ['checkId']);
    const id = communityId(data.checkId);
    const item = (await db.collection('fieldChecks').doc(id).get()).data();
    if (!item || item.actorUid !== uid) throw new HttpsError('not-found', 'Visit not found.');
    const photos = [];
    for (const path of item.rawMediaPaths as string[]) {
      if (!path.startsWith(`private/reports/${uid}/${item.reportId}/field-checks/${id}/`))
        throw new HttpsError('internal', 'Visit photos unavailable.');
      const [bytes] = await getStorage().bucket().file(path).download();
      photos.push({ base64: bytes.toString('base64') });
    }
    return {
      ...publicFieldCheck({ ...item, id }),
      reportId: item.reportId,
      reference: item.reference,
      photos,
    };
  }
  if (action === 'community-register-push' || action === 'community-unregister-push') {
    const data = exactCommand(
      value,
      action === 'community-register-push'
        ? ['installationId', 'platform', 'token']
        : ['installationId'],
    );
    if (typeof data.installationId !== 'string' || !UUID_PATTERN.test(data.installationId))
      throw new HttpsError('invalid-argument', 'Invalid device registration.');
    const devices = db.collection('residentDevices').doc(uid).collection('devices');
    const ref = devices.doc(data.installationId);
    if (action === 'community-unregister-push') {
      await ref.delete();
      return { registered: false };
    }
    if (
      !['android', 'ios'].includes(data.platform as string) ||
      typeof data.token !== 'string' ||
      !/^[A-Za-z0-9:_-]{32,4096}$/.test(data.token)
    )
      throw new HttpsError('invalid-argument', 'A valid mobile push registration is required.');
    const token = data.token;
    const registration = db
      .collection('communityPushRegistrations')
      .doc(createHash('sha256').update(token).digest('hex'));
    await db.runTransaction(async (transaction) => {
      const [current, list, previous] = await Promise.all([
        transaction.get(ref),
        transaction.get(devices.limit(5)),
        transaction.get(registration),
      ]);
      if (!current.exists && list.size >= 5)
        throw new HttpsError('resource-exhausted', 'At most five devices can receive updates.');
      const old = previous.data();
      if (old && (old.uid !== uid || old.installationId !== data.installationId))
        transaction.delete(
          db
            .collection('residentDevices')
            .doc(old.uid)
            .collection('devices')
            .doc(old.installationId),
        );
      transaction.set(ref, { token, platform: data.platform, updatedAt: new Date().toISOString() });
      transaction.set(registration, { uid, installationId: data.installationId });
    });
    return { registered: true };
  }
  throw new HttpsError('invalid-argument', 'Unknown community command.');
}
