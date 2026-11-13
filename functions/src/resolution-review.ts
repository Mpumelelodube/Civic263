import { randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { checkReport, REVIEW_MODEL, REVIEW_POLICY } from './automatic-review.ts';
import { readResolution } from '../../packages/domain/src/report-resolution.ts';
import { toPublicIncident } from '../../packages/domain/src/publication.ts';
import type { IncidentRecord } from '../../packages/domain/src/models.ts';

// This worker screens publication only. The resident's resolved state never depends on AI approval.
export async function reviewResolutionEvidence(reportId: string, assess = checkReport) {
  const db = getFirestore();
  const ref = db.collection('reports').doc(reportId);
  const lease = randomUUID();
  const item = await db.runTransaction(async (transaction) => {
    const data = (await transaction.get(ref)).data();
    if (
      !data ||
      data.workflowStatus !== 'resolved' ||
      data.publicationStatus !== 'published' ||
      data.resolution?.evidenceStatus !== 'pending' ||
      data.receipt?.testOnly === true
    )
      return null;
    if (data.resolutionReviewUntil > Date.now()) throw new Error('Resolution review is running');
    const attempts = (data.resolutionReviewAttempts ?? 0) + 1;
    if (attempts > 5) {
      transaction.update(ref, {
        resolutionReviewLease: lease,
        resolutionReviewUntil: Date.now() + 300000,
      });
      return { ...data, attempts, capped: true };
    }
    if (attempts === 1) {
      const quota = db.collection('reviewDailyUsage').doc(new Date().toISOString().slice(0, 10));
      const count = (await transaction.get(quota)).data()?.count ?? 0;
      if (count >= 100) {
        // No model call after the daily cap; finalize private through the same projection path.
        transaction.update(ref, {
          resolutionReviewAttempts: 5,
          resolutionReviewLease: lease,
          resolutionReviewUntil: Date.now() + 300000,
        });
        return { ...data, attempts: 5, capped: true };
      }
      transaction.set(quota, { count: count + 1, expiresAt: new Date(Date.now() + 2 * 86400000) });
    }
    transaction.update(ref, {
      resolutionReviewLease: lease,
      resolutionReviewUntil: Date.now() + 300000,
      resolutionReviewAttempts: attempts,
    });
    return { ...data, attempts, capped: false };
  });
  if (!item) return;
  // Firestore document data is private; only readResolution and toPublicIncident cross the boundary.
  const report = item as Record<string, unknown> & { attempts: number; capped: boolean };
  let safeCount = 0;
  let retry = false;
  if (!report.capped) {
    try {
      const evidence = report.resolutionEvidence as { rawMediaPaths: string[] };
      if (!evidence?.rawMediaPaths?.length || evidence.rawMediaPaths.length > 3)
        throw new Error('Missing evidence');
      const photos: Buffer[] = [];
      for (const path of evidence.rawMediaPaths) {
        if (!path.startsWith(`private/reports/${report.ownerUid}/${reportId}/resolution/`))
          throw new Error('Invalid evidence path');
        const [bytes] = await getStorage().bucket().file(path).download();
        photos.push(bytes);
      }
      const decision = await assess(report, photos, 'resolution');
      if (decision.publish) {
        for (const [index, source] of decision.safePhotos.entries()) {
          const bytes = await sharp(photos[source])
            .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
          // Each lease has its own derivative batch; a late worker cannot overwrite a winner.
          await getStorage()
            .bucket()
            .file(`public/incidents/${reportId}/resolution/${lease}/${index}.jpg`)
            .save(bytes, {
              resumable: false,
              metadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' },
            });
        }
        safeCount = decision.safePhotos.length;
      }
    } catch {
      retry = report.attempts < 5;
    }
  }
  await db.runTransaction(async (transaction) => {
    const incidentRef = db.collection('incidents').doc(reportId);
    const publicRef = db.collection('publicIncidents').doc(reportId);
    const [current, canonical, published] = await Promise.all([
      transaction.get(ref),
      transaction.get(incidentRef),
      transaction.get(publicRef),
    ]);
    const data = current.data();
    const incident = canonical.data() as IncidentRecord | undefined;
    if (
      !data ||
      data.resolution?.evidenceStatus !== 'pending' ||
      data.resolutionReviewLease !== lease
    )
      return;
    if (retry) {
      transaction.update(ref, { resolutionReviewUntil: 0 });
      return;
    }
    const original = readResolution(data.resolution);
    if (!original) return;
    const resolution = {
      ...original,
      evidenceStatus: safeCount ? ('published' as const) : ('private' as const),
      photoCount: safeCount,
    };
    // Never recreate an unpublished/deleted canonical record or change lifecycle/handoff timestamps.
    if (
      incident &&
      incident.publicationStatus === 'published' &&
      incident.workflowStatus === 'resolved' &&
      published.exists &&
      incident.resolution?.resolvedAt === original.resolvedAt
    ) {
      const updated = {
        ...incident,
        resolution,
        publicationVersion: incident.publicationVersion + 1,
      };
      transaction.update(incidentRef, {
        resolution,
        resolutionMediaBatchId: safeCount ? lease : null,
        publicationVersion: updated.publicationVersion,
      });
      transaction.set(publicRef, toPublicIncident(updated)!);
    }
    transaction.update(ref, { resolution, resolutionReviewUntil: 0 });
    transaction.set(db.collection('reviewAudit').doc(`${reportId}_resolution_${REVIEW_POLICY}`), {
      reportId,
      purpose: 'resolution-privacy',
      decision: resolution.evidenceStatus,
      policy: REVIEW_POLICY,
      model: REVIEW_MODEL,
      reviewedAt: new Date().toISOString(),
    });
  });
  if (retry) throw new Error('Resolution review needs a retry');
}
