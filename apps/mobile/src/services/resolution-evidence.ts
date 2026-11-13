import { Directory, File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import {
  checkResolutionPosition,
  type DraftPhoto,
  parseCommunityCheck,
  parseResolutionFix,
  type CommunityCheckCommand,
  type FieldCheckKind,
  type ResolutionFix,
} from '@civic263/domain';
import { removePhotoFile } from './photos';

export type CapturedResolutionPhoto = DraftPhoto & { capturedAt: number; location: ResolutionFix };
export type ResolutionDraft = {
  photos: CapturedResolutionPhoto[];
  pending?: CommunityCheckCommand;
};
export const resolutionDraftKey = (id: string, kind: FieldCheckKind, fixId?: string) =>
  `${id}-${kind}-${fixId ?? 'new'}`;
function fileFor(reportId: string) {
  if (
    !/^[a-f0-9]{40}(?:-(?:report-fix|confirm-fix|reject-fix)-(?:new|[a-f0-9]{40}))?$/.test(reportId)
  )
    throw new Error('Choose a saved report.');
  const directory = new Directory(Paths.document, 'civic263-resolutions');
  directory.create({ idempotent: true, intermediates: true });
  return new File(directory, `${reportId}.json`);
}
export async function loadResolutionDraft(reportId: string): Promise<ResolutionDraft> {
  const file = fileFor(reportId);
  if (!file.exists) return { photos: [] };
  const value = JSON.parse(await file.text()) as ResolutionDraft;
  if (!Array.isArray(value.photos) || value.photos.length > 3)
    throw new Error('Saved evidence could not be read.');
  if (value.pending) value.pending = parseCommunityCheck(value.pending);
  return value;
}
export async function saveResolutionDraft(reportId: string, draft: ResolutionDraft) {
  const file = fileFor(reportId);
  const temporary = new File(file.parentDirectory, `${reportId}.tmp`);
  temporary.create({ overwrite: true });
  await temporary.write(JSON.stringify(draft));
  await temporary.move(file, { overwrite: true });
}
export function clearResolutionDraft(reportId: string, draft: ResolutionDraft) {
  const file = fileFor(reportId);
  if (file.exists) file.delete();
  draft.photos.forEach(removePhotoFile);
}
export async function currentResolutionFix(
  anchor?: { latitude: number; longitude: number } | null,
) {
  if (!(await Location.requestForegroundPermissionsAsync()).granted)
    throw new Error('Allow precise location access in Settings to confirm you are at the site.');
  return new Promise<ResolutionFix>((resolve, reject) => {
    let subscription: Location.LocationSubscription | undefined;
    let settled = false;
    let lastError = 'GPS is taking too long. Move outdoors, enable precise location and retry.';
    const finish = (fix?: ResolutionFix, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription?.remove();
      if (fix) resolve(fix);
      else reject(error ?? new Error(lastError));
    };
    const timer = setTimeout(() => finish(), 20000);
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, timeInterval: 1000, distanceInterval: 0 },
      (point) => {
        if (settled) return;
        if (point.mocked === true) {
          finish(undefined, new Error('A non-mocked GPS position is required.'));
          return;
        }
        if (
          point.coords.accuracy === null ||
          point.coords.accuracy <= 0 ||
          point.coords.accuracy > 20
        ) {
          lastError = `GPS accuracy is ${point.coords.accuracy === null ? 'unavailable' : `+/-${Math.round(point.coords.accuracy)} m`}. Move outdoors, enable precise location and retry. We need +/-20 m or better.`;
          return;
        }
        // A foreground watch waits for a usable fix rather than accepting its first coarse reading.
        if (point.timestamp < Date.now() - 120000 || point.timestamp > Date.now() + 15000) return;
        const fix: ResolutionFix = {
          latitude: point.coords.latitude,
          longitude: point.coords.longitude,
          accuracyMeters: point.coords.accuracy,
          timestamp: point.timestamp,
          mocked: false,
        };
        try {
          if (anchor) checkResolutionPosition(fix, anchor);
          else parseResolutionFix(fix);
          finish(fix);
        } catch (reason) {
          finish(
            undefined,
            reason instanceof Error ? reason : new Error('Check your report location.'),
          );
        }
      },
      () => finish(undefined, new Error('GPS is unavailable. Enable location services and retry.')),
    )
      .then((value) => {
        if (settled) value.remove();
        else subscription = value;
      })
      .catch((reason) =>
        finish(
          undefined,
          reason instanceof Error ? reason : new Error('Could not start the GPS check.'),
        ),
      );
  });
}
