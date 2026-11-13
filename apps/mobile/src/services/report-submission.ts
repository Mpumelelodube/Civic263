import { File } from 'expo-file-system';
import { httpsCallable } from 'firebase/functions';
import {
  PHOTO_LIMITS,
  parseReportSubmission,
  type ReportDraft,
  type SubmissionReceipt,
} from '@civic263/domain';
import { residentServices, intakeEnabled } from './firebase';
import { updateDraft } from './drafts';

export async function submitDraft(draft: ReportDraft): Promise<ReportDraft> {
  if (draft.receipt) return draft;
  if (!intakeEnabled)
    throw new Error(
      'Server submission is not enabled for this build. Your photos and draft can still be saved.',
    );
  if ((draft.photos?.length ?? 0) > PHOTO_LIMITS.maximum)
    throw new Error('Attach no more than three photos before sending.');
  const { functions } = await residentServices();
  const photos = [];
  for (const photo of draft.photos ?? []) {
    const file = new File(photo.uri);
    if (!file.exists || file.size > PHOTO_LIMITS.maxBytes)
      throw new Error('A saved photo is missing or too large. Your draft has been preserved.');
    photos.push({
      id: photo.id,
      width: photo.width,
      height: photo.height,
      base64: await file.base64(),
    });
  }
  const input = parseReportSubmission({
    submissionId: draft.id,
    categoryId: draft.categoryId,
    description: draft.description,
    landmark: draft.landmark,
    photos,
    ...(draft.location ? { location: draft.location } : {}),
  });
  // Freeze the retry payload before the network call. A lost response must not create a second report.
  const pending = await updateDraft({
    ...draft,
    submissionStartedAt: draft.submissionStartedAt ?? new Date().toISOString(),
  });
  let response;
  try {
    response = await httpsCallable<typeof input, SubmissionReceipt>(functions, 'submitReport', {
      timeout: 70000,
    })(input);
  } catch (reason) {
    const code =
      typeof reason === 'object' && reason && 'code' in reason ? String(reason.code) : '';
    // These definite rejections happen before a report can be created. Let the resident fix it.
    if (
      [
        'functions/invalid-argument',
        'functions/unauthenticated',
        'functions/resource-exhausted',
        'functions/not-found',
      ].includes(code)
    ) {
      const editable = { ...pending };
      delete editable.submissionStartedAt;
      await updateDraft(editable);
    }
    throw reason;
  }
  const receipt = response.data;
  if (
    !receipt ||
    typeof receipt.reportId !== 'string' ||
    typeof receipt.reference !== 'string' ||
    typeof receipt.testOnly !== 'boolean' ||
    !Number.isFinite(Date.parse(receipt.receivedAt)) ||
    receipt.photoCount !== photos.length
  )
    throw new Error(
      'The server response could not be confirmed. Retry this saved draft to check its receipt.',
    );
  return updateDraft({ ...pending, receipt });
}

export function submissionError(reason: unknown): string {
  const code = typeof reason === 'object' && reason && 'code' in reason ? String(reason.code) : '';
  if (code === 'auth/operation-not-allowed')
    return 'Anonymous resident sign-in needs enabling in Firebase. Your draft is saved.';
  if (
    code === 'auth/network-request-failed' ||
    code === 'functions/internal' ||
    code === 'functions/unavailable' ||
    code === 'functions/deadline-exceeded'
  )
    return 'Could not confirm delivery. Your draft is saved. Retry it from My reports using the same submission.';
  if (code === 'functions/unauthenticated')
    return 'The server requires a verified app and reporting identity. This build is not ready for live submissions.';
  return reason instanceof Error
    ? reason.message
    : 'Could not send. Your draft is saved; retry from My reports.';
}
