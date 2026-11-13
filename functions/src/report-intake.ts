import { createHash, randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError } from 'firebase-functions/v2/https';
import sharp from 'sharp';
import { error as logError } from 'firebase-functions/logger';
import {
  PHOTO_LIMITS,
  parseReportSubmission,
  type ReportSubmissionInput,
  type SubmissionReceipt,
} from '../../packages/domain/src/report-submission.ts';

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export async function validatePhotos(input: Pick<ReportSubmissionInput, 'photos'>) {
  const seen = new Set<string>();
  const photos = [];
  // Sequential processing bounds memory when handling several camera images.
  for (const photo of input.photos) {
    const bytes = Buffer.from(photo.base64, 'base64');
    if (
      bytes.length > PHOTO_LIMITS.maxBytes ||
      !bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    )
      throw new HttpsError('invalid-argument', 'Only compressed JPEG photos are accepted.');
    const hash = digest(bytes);
    if (seen.has(hash))
      throw new HttpsError('invalid-argument', 'Choose different photos of the issue.');
    seen.add(hash);
    try {
      const image = sharp(bytes, {
        limitInputPixels: PHOTO_LIMITS.maxSide ** 2,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      if (
        metadata.format !== 'jpeg' ||
        metadata.width !== photo.width ||
        metadata.height !== photo.height ||
        (metadata.pages && metadata.pages > 1)
      )
        throw new Error('Invalid image dimensions.');
      // Re-encoding drops EXIF/GPS and other embedded metadata before private storage.
      const sanitized = await image.rotate().jpeg({ quality: 80 }).toBuffer();
      photos.push({ id: photo.id, bytes: sanitized });
    } catch {
      throw new HttpsError(
        'invalid-argument',
        'A photo could not be decoded. Remove it and choose it again.',
      );
    }
  }
  return photos;
}

export async function receiveReport(
  data: unknown,
  ownerUid: string,
  testIdentity = false,
): Promise<SubmissionReceipt> {
  let input: ReportSubmissionInput;
  try {
    input = parseReportSubmission(data);
  } catch (error) {
    throw new HttpsError(
      'invalid-argument',
      error instanceof Error ? error.message : 'Invalid report.',
    );
  }
  const reportId = digest(`${ownerUid}\0${input.submissionId}`).slice(0, 40);
  const payloadHash = digest(JSON.stringify(input));
  const db = getFirestore();
  const reservation = db.collection('reportSubmissions').doc(reportId);
  const lease = randomUUID();
  const now = Date.now();
  const quota = db
    .collection('reportRateLimits')
    .doc(`${ownerUid}_${new Date(now).toISOString().slice(0, 10)}`);
  const priorReceipt = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reservation);
    const previous = snapshot.data();
    if (previous) {
      if (previous.ownerUid !== ownerUid || previous.payloadHash !== payloadHash)
        throw new HttpsError(
          'already-exists',
          'This submission has already started with different details.',
        );
      if (previous.receipt) return previous.receipt as SubmissionReceipt;
      if (previous.leaseUntil > now)
        throw new HttpsError(
          'aborted',
          'This report is still being processed. Please retry in a moment.',
        );
    } else {
      const count = (await transaction.get(quota)).data()?.count ?? 0;
      if (count >= 10)
        throw new HttpsError(
          'resource-exhausted',
          'The daily reporting limit has been reached. Keep this draft and try tomorrow.',
        );
      transaction.set(quota, { count: count + 1, expiresAt: new Date(now + 2 * 86400000) });
    }
    transaction.set(reservation, {
      ownerUid,
      payloadHash,
      lease,
      leaseUntil: now + 120000,
      createdAt: previous?.createdAt ?? new Date(now).toISOString(),
    });
    return null;
  });
  if (priorReceipt) return priorReceipt;
  let stage = 'photo-validation';
  try {
    const photos = await validatePhotos(input);
    stage = 'private-storage';
    const bucket = getStorage().bucket();
    const rawMediaPaths: string[] = [];
    for (const photo of photos) {
      const path = `private/reports/${ownerUid}/${reportId}/${photo.id}.jpg`;
      // No download token or public ACL is created. Client storage access remains denied.
      await bucket.file(path).save(photo.bytes, {
        resumable: false,
        metadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' },
      });
      rawMediaPaths.push(path);
    }
    const receipt: SubmissionReceipt = {
      testOnly: process.env.FUNCTIONS_EMULATOR === 'true' || testIdentity,
      reportId,
      reference: `C263-${reportId.slice(0, 12).toUpperCase()}`,
      receivedAt: new Date().toISOString(),
      photoCount: photos.length,
    };
    stage = 'receipt';
    await db.runTransaction(async (transaction) => {
      const current = (await transaction.get(reservation)).data();
      if (current?.lease !== lease)
        throw new HttpsError('aborted', 'Please retry to confirm the report status.');
      transaction.create(db.collection('reports').doc(reportId), {
        ownerUid,
        categoryId: input.categoryId,
        description: input.description,
        landmark: input.landmark,
        ...(input.location ? { location: input.location } : {}),
        rawMediaPaths,
        moderationStatus: 'pending',
        reviewStatus: 'queued',
        publicationStatus: 'hidden',
        workflowStatus: 'received',
        handoffStatus: 'not-sent',
        createdAt: receipt.receivedAt,
        receipt,
      });
      transaction.update(reservation, { receipt, leaseUntil: 0 });
    });
    return receipt;
  } catch (error) {
    // Let an explicit retry repair a partially uploaded submission using the same ID.
    await db
      .runTransaction(async (transaction) => {
        const current = (await transaction.get(reservation)).data();
        if (current?.lease === lease && !current.receipt) {
          if (error instanceof HttpsError && error.code === 'invalid-argument')
            transaction.delete(reservation);
          else transaction.update(reservation, { leaseUntil: 0 });
        }
      })
      .catch(() => {});
    if (error instanceof HttpsError) throw error;
    logError('Report intake could not finish', {
      stage,
      code: typeof error === 'object' && error && 'code' in error ? String(error.code) : 'unknown',
    });
    throw new HttpsError(
      'unavailable',
      'The server could not finish receiving this report. Keep the draft and retry.',
    );
  }
}
