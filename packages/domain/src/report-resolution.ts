import { WORKFLOW_LABELS, type WorkflowStatus } from './models.ts';
import { distanceKm } from './geo.ts';
import { isValidCoordinate } from './validation.ts';
import { parsePhotoInputs, UUID_PATTERN, type ReportPhotoInput } from './report-submission.ts';

export const RESOLUTION_RADIUS_METRES = 20;
export interface ResolutionFix {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
  mocked: boolean;
}
export interface ResolutionPhoto extends ReportPhotoInput {
  captureSource: 'camera';
  capturedAt: number;
  location: ResolutionFix;
}
export interface ResolutionCommand {
  action: 'resolve';
  reportId: string;
  attemptId: string;
  location: ResolutionFix;
  photos: ResolutionPhoto[];
}

export interface ReportResolution {
  source: 'resident';
  resolvedAt: string;
  evidenceStatus?: 'pending' | 'published' | 'private';
  photoCount?: number;
}

export interface ResolutionReceipt {
  reportId: string;
  workflowStatus: 'resolved';
  resolution: ReportResolution;
}

export function parseResolutionFix(value: unknown): ResolutionFix {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Get a fresh GPS position at the report location.');
  const point = value as ResolutionFix;
  if (
    Object.keys(point).some(
      (key) => !['latitude', 'longitude', 'accuracyMeters', 'timestamp', 'mocked'].includes(key),
    ) ||
    typeof point.latitude !== 'number' ||
    typeof point.longitude !== 'number' ||
    !isValidCoordinate(point.latitude, point.longitude) ||
    typeof point.accuracyMeters !== 'number' ||
    !Number.isFinite(point.accuracyMeters) ||
    point.accuracyMeters <= 0 ||
    point.accuracyMeters > RESOLUTION_RADIUS_METRES ||
    typeof point.timestamp !== 'number' ||
    !Number.isFinite(point.timestamp) ||
    point.timestamp <= 0 ||
    point.mocked !== false
  )
    throw new Error(
      'An accurate, non-mocked GPS position is required (accuracy within 20 metres).',
    );
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    accuracyMeters: point.accuracyMeters,
    timestamp: point.timestamp,
    mocked: false,
  };
}

export function checkResolutionPosition(
  point: ResolutionFix,
  anchor: { latitude: number; longitude: number } | null | undefined,
  now = Date.now(),
  maxAge = 120000,
) {
  parseResolutionFix(point);
  if (!anchor || !isValidCoordinate(anchor.latitude, anchor.longitude))
    throw new Error('This report has no saved pin for an on-site location check.');
  if (point.timestamp < now - maxAge || point.timestamp > now + 15000)
    throw new Error('Get a fresh GPS position and check the device clock.');
  const metres = distanceKm(anchor, point) * 1000;
  if (metres > RESOLUTION_RADIUS_METRES)
    throw new Error(
      `You are ${Math.round(metres)} metres from the report pin. Move within 20 metres to continue.`,
    );
  return metres;
}

export function checkResolutionEvidence(
  command: Pick<ResolutionCommand, 'location' | 'photos'>,
  anchor: Parameters<typeof checkResolutionPosition>[1],
  now = Date.now(),
) {
  checkResolutionPosition(command.location, anchor, now);
  for (const photo of command.photos) {
    if (
      photo.capturedAt < now - 600000 ||
      photo.capturedAt > now + 15000 ||
      Math.abs(photo.location.timestamp - photo.capturedAt) > 30000
    )
      throw new Error('Take new photos at the site. Resolution photos expire after 10 minutes.');
    checkResolutionPosition(photo.location, anchor, now, 630000);
  }
}

export function parseResolutionCommand(value: unknown): ResolutionCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid resolution request.');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (key) => !['action', 'reportId', 'attemptId', 'location', 'photos'].includes(key),
    ) ||
    data.action !== 'resolve' ||
    typeof data.reportId !== 'string' ||
    !/^[a-f0-9]{40}$/.test(data.reportId) ||
    typeof data.attemptId !== 'string' ||
    !UUID_PATTERN.test(data.attemptId) ||
    !Array.isArray(data.photos) ||
    data.photos.length < 1 ||
    data.photos.length > 3
  )
    throw new Error('Invalid resolution request.');
  const raw = data.photos as Record<string, unknown>[];
  if (
    raw.some(
      (photo) =>
        !photo ||
        typeof photo !== 'object' ||
        Object.keys(photo).some(
          (key) =>
            ![
              'id',
              'base64',
              'width',
              'height',
              'captureSource',
              'capturedAt',
              'location',
            ].includes(key),
        ) ||
        photo.captureSource !== 'camera' ||
        typeof photo.capturedAt !== 'number' ||
        !Number.isFinite(photo.capturedAt),
    )
  )
    throw new Error('Take 1–3 new photos with the in-app camera.');
  const parsed = parsePhotoInputs(
    raw.map(({ id, base64, width, height }) => ({ id, base64, width, height })),
  );
  return {
    action: 'resolve',
    reportId: data.reportId,
    attemptId: data.attemptId,
    location: parseResolutionFix(data.location),
    photos: parsed.map((photo, i) => ({
      ...photo,
      captureSource: 'camera',
      capturedAt: raw[i]!.capturedAt as number,
      location: parseResolutionFix(raw[i]!.location),
    })),
  };
}

export function readResolution(value: unknown): ReportResolution | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  return data.source === 'resident' &&
    typeof data.resolvedAt === 'string' &&
    data.resolvedAt.length <= 35 &&
    Number.isFinite(Date.parse(data.resolvedAt))
    ? {
        source: 'resident',
        resolvedAt: data.resolvedAt,
        ...(['pending', 'published', 'private'].includes(String(data.evidenceStatus))
          ? {
              evidenceStatus: data.evidenceStatus as NonNullable<
                ReportResolution['evidenceStatus']
              >,
              photoCount:
                data.evidenceStatus === 'published' &&
                Number.isInteger(data.photoCount) &&
                Number(data.photoCount) >= 0 &&
                Number(data.photoCount) <= 3
                  ? Number(data.photoCount)
                  : 0,
            }
          : {}),
      }
    : null;
}

export function workflowLabel(
  item: { workflowStatus: WorkflowStatus; resolution?: ReportResolution; communityResolution?: { status: string } },
  owner = false,
) {
  if (item.workflowStatus === 'resolved' && item.communityResolution?.status === 'confirmed') return 'Community-confirmed resolved';
  return item.workflowStatus === 'resolved' && item.resolution?.source === 'resident'
    ? owner
      ? 'Resolved by you'
      : 'Resolved by reporter'
    : WORKFLOW_LABELS[item.workflowStatus];
}
