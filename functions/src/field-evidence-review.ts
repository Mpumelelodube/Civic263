import { randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { checkReport, REVIEW_MODEL, REVIEW_POLICY, type Decision } from './automatic-review.ts';
import { reserveAutomaticReview } from './review-controls.ts';

export async function reviewFieldEvidence(checkId: string, assess = checkReport) {
  const db = getFirestore();
  const ref = db.collection('fieldChecks').doc(checkId);
  const lease = randomUUID();
  const item = await db.runTransaction(async (transaction) => {
    const data = (await transaction.get(ref)).data();
    if (!data || data.evidenceStatus !== 'pending') return null;
    if (data.reviewLeaseUntil > Date.now()) throw new Error('Visit privacy review is running');
    const attempts = (data.reviewAttempts ?? 0) + 1;
    let capped = data.testOnly === true || attempts > 5;
    // Switched off or past the daily limit: no paid call, and the visit photos stay private.
    if (!capped) capped = (await reserveAutomaticReview(transaction, attempts === 1)) !== 'allowed';
    transaction.update(ref, {
      reviewLease: lease,
      reviewLeaseUntil: Date.now() + 300000,
      reviewAttempts: capped ? 5 : attempts,
    });
    return { ...data, attempts, capped };
  });
  if (!item) return;
  const data = item as FirebaseFirestore.DocumentData;
  let safeCount = 0;
  let retry = false;
  let scores: Decision['scores'] | null = null;
  if (!data.capped) {
    try {
      if (
        !Array.isArray(data.rawMediaPaths) ||
        data.rawMediaPaths.length < 1 ||
        data.rawMediaPaths.length > 3
      )
        throw new Error('Missing visit photos');
      const photos: Buffer[] = [];
      for (const path of data.rawMediaPaths as string[]) {
        if (
          !path.startsWith(
            `private/reports/${data.actorUid}/${data.reportId}/field-checks/${checkId}/`,
          )
        )
          throw new Error('Invalid private visit path');
        const [bytes] = await getStorage().bucket().file(path).download();
        photos.push(bytes);
      }
      const decision = await assess(data, photos, 'resolution');
      scores = decision.scores ?? null;
      if (decision.publish) {
        for (const [index, source] of decision.safePhotos.entries()) {
          const bytes = await sharp(photos[source])
            .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
          await getStorage()
            .bucket()
            .file(`public/incidents/${data.reportId}/field-checks/${checkId}/${lease}/${index}.jpg`)
            .save(bytes, {
              resumable: false,
              metadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' },
            });
        }
        safeCount = decision.safePhotos.length;
      }
    } catch {
      retry = data.attempts < 5;
    }
  }
  let adopted = false;
  await db.runTransaction(async (transaction) => {
    adopted = false;
    const publicRef = db.collection('publicFieldChecks').doc(checkId);
    const [current, published, incident] = await Promise.all([
      transaction.get(ref),
      transaction.get(publicRef),
      transaction.get(db.collection('publicIncidents').doc(data.reportId)),
    ]);
    if (current.data()?.reviewLease !== lease || current.data()?.evidenceStatus !== 'pending')
      return;
    if (retry) {
      transaction.update(ref, { reviewLeaseUntil: 0 });
      return;
    }
    const evidenceStatus = safeCount ? 'published' : 'private';
    adopted = safeCount > 0;
    transaction.update(ref, {
      evidenceStatus,
      photoCount: safeCount,
      reviewMediaBatchId: safeCount ? lease : null,
      reviewLeaseUntil: 0,
    });
    if (published.data()?.reportId === data.reportId && incident.exists)
      transaction.update(publicRef, { evidenceStatus, photoCount: safeCount });
    transaction.set(db.collection('reviewAudit').doc(`${checkId}_field_${REVIEW_POLICY}`), {
      checkId,
      reportId: data.reportId,
      purpose: 'field-visit-privacy',
      decision: evidenceStatus,
      policy: REVIEW_POLICY,
      model: REVIEW_MODEL,
      scores,
      reviewedAt: new Date().toISOString(),
    });
  });
  // A batch the check never referenced (withdrawn, erased or superseded) is removed by exact
  // name; the backend role cannot list objects.
  if (safeCount && !adopted)
    await Promise.all(
      Array.from({ length: safeCount }, (_, index) =>
        getStorage()
          .bucket()
          .file(`public/incidents/${data.reportId}/field-checks/${checkId}/${lease}/${index}.jpg`)
          .delete({ ignoreNotFound: true }),
      ),
    ).catch(() => {});
  if (retry) throw new Error('Visit privacy review needs a retry');
}
