import { getFirestore, FieldPath, type DocumentSnapshot } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError } from 'firebase-functions/v2/https';
import { readResolution } from '../../packages/domain/src/report-resolution.ts';
import { readCommunityResolution } from '../../packages/domain/src/community.ts';
import type {
  ResidentReport,
  ResidentReportDetail,
} from '../../packages/domain/src/resident-reports.ts';

export const REPORT_ID = /^[a-f0-9]{40}$/;
export function reportRequest(data: unknown, field: 'reportId' | 'cursor', optional = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new HttpsError('invalid-argument', 'Invalid report request.');
  const value = data as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== field))
    throw new HttpsError('invalid-argument', 'Unknown report request field.');
  if (optional && (value[field] === undefined || value[field] === null)) return null;
  if (typeof value[field] !== 'string' || !REPORT_ID.test(value[field]))
    throw new HttpsError('invalid-argument', 'Invalid report identifier.');
  return value[field];
}

export function toResidentReport(snapshot: DocumentSnapshot): ResidentReport {
  const item = snapshot.data()!;
  const resolution = readResolution(item.resolution);
  const communityResolution = readCommunityResolution(item.communityResolution);
  return {
    id: snapshot.id,
    reference: item.receipt.reference,
    categoryId: item.categoryId,
    description: item.description,
    landmark: item.landmark,
    createdAt: item.createdAt,
    moderationStatus: item.moderationStatus,
    publicationStatus: item.publicationStatus,
    workflowStatus: item.workflowStatus,
    reviewStatus: item.reviewStatus ?? 'queued',
    reviewReason: item.reviewReason ?? null,
    photoCount: item.rawMediaPaths.length,
    testOnly: item.receipt.testOnly === true,
    incidentReference: item.publicationStatus === 'published' ? item.receipt.reference : null,
    ...(resolution ? { resolution } : {}),
    ...(communityResolution ? { communityResolution } : {}),
  };
}

export async function listResidentReports(data: unknown, ownerUid: string) {
  const cursor = reportRequest(data, 'cursor', true);
  const db = getFirestore();
  let query = db
    .collection('reports')
    .where('ownerUid', '==', ownerUid)
    .orderBy('createdAt', 'desc')
    .orderBy(FieldPath.documentId())
    .limit(21);
  if (cursor) {
    const after = await db.collection('reports').doc(cursor).get();
    if (!after.exists || after.data()?.ownerUid !== ownerUid)
      throw new HttpsError('not-found', 'Report not found.');
    query = query.startAfter(after);
  }
  const result = await query.get();
  return {
    reports: result.docs.slice(0, 20).map(toResidentReport),
    nextCursor: result.size > 20 ? result.docs[19]!.id : null,
  };
}

export async function readResidentReport(
  data: unknown,
  ownerUid: string,
): Promise<ResidentReportDetail> {
  const id = reportRequest(data, 'reportId')!;
  const snapshot = await getFirestore().collection('reports').doc(id).get();
  if (!snapshot.exists || snapshot.data()?.ownerUid !== ownerUid)
    throw new HttpsError('not-found', 'Report not found.');
  const item = snapshot.data()!;
  const bucket = getStorage().bucket();
  const photos: ResidentReportDetail['photos'] = [];
  for (const path of item.rawMediaPaths as string[]) {
    if (!path.startsWith(`private/reports/${ownerUid}/${id}/`))
      throw new HttpsError('internal', 'Report photos are unavailable.');
    const [bytes] = await bucket.file(path).download();
    photos.push({ base64: bytes.toString('base64') });
  }
  const resolutionPhotos: { base64: string }[] = [];
  for (const path of (item.resolutionEvidence?.rawMediaPaths ?? []) as string[]) {
    if (!path.startsWith(`private/reports/${ownerUid}/${id}/resolution/`))
      throw new HttpsError('internal', 'Resolution photos are unavailable.');
    const [bytes] = await bucket.file(path).download();
    resolutionPhotos.push({ base64: bytes.toString('base64') });
  }
  return {
    ...toResidentReport(snapshot),
    location: item.location ?? null,
    photos,
    resolutionPhotos,
  };
}
