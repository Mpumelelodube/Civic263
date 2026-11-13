import { FieldPath, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Request, Response } from 'express';
import { toPublicIncident } from '../../packages/domain/src/publication.ts';
import { distanceKm } from '../../packages/domain/src/geo.ts';
import type { IncidentRecord, PublicIncidentResponse } from '../../packages/domain/src/models.ts';
import { REPORT_ID } from './report-access.ts';
import { isOpenIncident } from '../../packages/domain/src/models.ts';
import { error as logError } from 'firebase-functions/logger';
import { UUID_PATTERN } from '../../packages/domain/src/report-submission.ts';
import { publicFieldCheck } from './community.ts';

function publicRecord(data: Record<string, unknown>) {
  return toPublicIncident({ ...data, publicationStatus: 'published' } as unknown as IncidentRecord);
}
const validCoordinate = (value: number, max: number) =>
  Number.isFinite(value) && Math.abs(value) <= max;

export async function servePublicApi(request: Request, response: Response) {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=30, must-revalidate',
  });
  if (request.method !== 'GET') {
    response.status(405).set('Allow', 'GET').json({ error: 'GET required.' });
    return;
  }
  const path = request.path.replace(/^\/api\/public/, '').replace(/\/$/, '') || '/incidents';
  const db = getFirestore();
  try {
    const checks =
      /^\/incidents\/([a-f0-9]{40})\/checks(?:\/([a-f0-9]{40})\/photos\/([0-2]))?$/.exec(path);
    if (checks) {
      const reportId = checks[1]!;
      const incident = await db.collection('publicIncidents').doc(reportId).get();
      if (!incident.exists || !publicRecord(incident.data()!)) {
        response.status(404).end();
        return;
      }
      if (checks[2]) {
        const [published, original] = await Promise.all([
          db.collection('publicFieldChecks').doc(checks[2]).get(),
          db.collection('fieldChecks').doc(checks[2]).get(),
        ]);
        const item = published.data();
        const privateItem = original.data();
        const index = Number(checks[3]);
        if (
          item?.reportId !== reportId ||
          privateItem?.reportId !== reportId ||
          item?.evidenceStatus !== 'published' ||
          privateItem?.evidenceStatus !== 'published' ||
          index >= (item?.photoCount ?? 0) ||
          index >= (privateItem?.photoCount ?? 0) ||
          typeof privateItem?.reviewMediaBatchId !== 'string' ||
          !UUID_PATTERN.test(privateItem.reviewMediaBatchId)
        ) {
          response.status(404).end();
          return;
        }
        const [bytes] = await getStorage()
          .bucket()
          .file(
            `public/incidents/${reportId}/field-checks/${checks[2]}/${privateItem.reviewMediaBatchId}/${index}.jpg`,
          )
          .download();
        response.set('Content-Type', 'image/jpeg').status(200).send(bytes);
        return;
      }
      if (Object.keys(request.query).some((key) => key !== 'cursor'))
        throw new Error('Invalid query');
      let query = db
        .collection('publicFieldChecks')
        .where('reportId', '==', reportId)
        .orderBy('createdAt', 'desc')
        .orderBy(FieldPath.documentId())
        .limit(21);
      if (request.query.cursor !== undefined) {
        if (typeof request.query.cursor !== 'string' || !REPORT_ID.test(request.query.cursor))
          throw new Error('Invalid cursor');
        const cursor = await db.collection('publicFieldChecks').doc(request.query.cursor).get();
        if (cursor.data()?.reportId !== reportId) throw new Error('Invalid cursor');
        query = query.startAfter(cursor);
      }
      const result = await query.get();
      response.json({
        items: result.docs
          .slice(0, 20)
          .map((item) => publicFieldCheck({ ...item.data(), id: item.id })),
        nextCursor: result.size > 20 ? result.docs[19]!.id : null,
      });
      return;
    }
    const match = /^\/incidents\/([a-f0-9]{40})(?:\/(photos|resolution-photos)\/([0-5]))?$/.exec(
      path,
    );
    if (match) {
      const snapshot = await db.collection('publicIncidents').doc(match[1]!).get();
      const incident = snapshot.exists ? publicRecord(snapshot.data()!) : null;
      if (!incident) {
        response.status(404).json({ error: 'Published issue not found.' });
        return;
      }
      if (match[3] !== undefined) {
        const resolution = match[2] === 'resolution-photos';
        if (
          Number(match[3]) >=
          (resolution ? (incident.resolution?.photoCount ?? 0) : (incident.photoCount ?? 0))
        ) {
          response.status(404).end();
          return;
        }
        let photoPath = `public/incidents/${incident.id}/${match[3]}.jpg`;
        if (resolution) {
          const canonical = (await db.collection('incidents').doc(incident.id).get()).data();
          const batch = canonical?.resolutionMediaBatchId;
          if (
            incident.resolution?.evidenceStatus !== 'published' ||
            canonical?.publicationStatus !== 'published' ||
            canonical?.resolution?.resolvedAt !== incident.resolution?.resolvedAt ||
            typeof batch !== 'string' ||
            !UUID_PATTERN.test(batch)
          ) {
            response.status(404).end();
            return;
          }
          photoPath = `public/incidents/${incident.id}/resolution/${batch}/${match[3]}.jpg`;
        }
        const [bytes] = await getStorage().bucket().file(photoPath).download();
        response.set('Content-Type', 'image/jpeg').status(200).send(bytes);
      } else response.json(incident);
      return;
    }
    if (path !== '/incidents') {
      response.status(404).json({ error: 'Not found.' });
      return;
    }
    const allowed = ['lat', 'lng', 'cursor'];
    if (Object.keys(request.query).some((key) => !allowed.includes(key)))
      throw new Error('Invalid query');
    const lat = request.query.lat === undefined ? undefined : Number(request.query.lat);
    const lng = request.query.lng === undefined ? undefined : Number(request.query.lng);
    const nearby = lat !== undefined || lng !== undefined;
    if (
      nearby &&
      (lat === undefined ||
        lng === undefined ||
        !validCoordinate(lat, 85) ||
        !validCoordinate(lng, 180))
    )
      throw new Error('Invalid location');
    const cursor = request.query.cursor;
    if (cursor !== undefined && (typeof cursor !== 'string' || !REPORT_ID.test(cursor)))
      throw new Error('Invalid cursor');
    const source = db.collection('publicIncidents');
    let query = nearby
      ? source
          .where('location.latitude', '>=', lat! - 0.046)
          .where('location.latitude', '<=', lat! + 0.046)
          .where('location.longitude', '>=', lng! - 5.1 / (111 * Math.cos((lat! * Math.PI) / 180)))
          .where('location.longitude', '<=', lng! + 5.1 / (111 * Math.cos((lat! * Math.PI) / 180)))
          .orderBy('location.latitude')
          .orderBy('location.longitude')
          .orderBy(FieldPath.documentId())
          .limit(101)
      : source.orderBy('firstAcceptedAt', 'desc').orderBy(FieldPath.documentId()).limit(41);
    if (cursor) {
      const after = await source.doc(cursor).get();
      if (!after.exists) throw new Error('Invalid cursor');
      query = query.startAfter(after);
    }
    const result = await query.get();
    const pageSize = nearby ? 100 : 40;
    const scanned = result.docs.slice(0, pageSize);
    const incidents = scanned
      .map((doc) => publicRecord(doc.data()))
      .filter(
        (item) =>
          item !== null &&
          (!nearby ||
            (isOpenIncident(item) &&
              item.location &&
              distanceKm({ latitude: lat!, longitude: lng! }, item.location) <= 5)),
      ) as PublicIncidentResponse['incidents'];
    const nextCursor = result.size > pageSize ? scanned.at(-1)!.id : null;
    const body: PublicIncidentResponse = {
      incidents,
      asOf: new Date().toISOString(),
      truncated: nextCursor !== null,
      nextCursor,
    };
    response.json(body);
  } catch (error) {
    const invalid = error instanceof Error && error.message.startsWith('Invalid');
    if (!invalid)
      logError('Public register query unavailable', {
        code:
          error && typeof error === 'object' && 'code' in error
            ? String(error.code).slice(0, 30)
            : 'unknown',
      });
    response
      .status(invalid ? 400 : 503)
      .set('Cache-Control', 'no-store')
      .json({
        error: invalid
          ? 'Invalid public register request.'
          : 'The public register is temporarily unavailable.',
      });
  }
}
