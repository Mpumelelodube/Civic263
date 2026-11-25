import type { ComplaintReason, ComplaintTarget, ResidentAppeal } from '@civic263/domain';
import { communityCall } from './community';

export async function requestHumanReview(reportId: string, note?: string) {
  const appeal = await communityCall<ResidentAppeal>('request-review', {
    reportId,
    ...(note?.trim() ? { note: note.trim() } : {}),
  });
  if (!appeal?.status) throw new Error('Could not confirm the request. Refresh this report.');
  return appeal;
}

export async function reportConcern(
  target: ComplaintTarget,
  reason: ComplaintReason,
  note?: string,
) {
  const result = await communityCall<{ received: boolean }>('report-concern', {
    target,
    reason,
    ...(note?.trim() ? { note: note.trim() } : {}),
  });
  if (result?.received !== true) throw new Error('Could not confirm the report. Please retry.');
}
