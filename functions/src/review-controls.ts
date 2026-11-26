import { getFirestore, type Transaction } from 'firebase-admin/firestore';

/** Paid automatic reviews (OpenAI Decisions) shared by reports, resolutions and visits. */
export const DAILY_REVIEW_LIMIT = 100;

/**
 * The administrator's switch for paid automatic review, set with scripts/manage-operations.py.
 * Review stays off unless this document says `enabled: true`, so a missing or damaged setting
 * can never start paid calls.
 */
export const automaticReviewSwitch = () =>
  getFirestore().collection('operations').doc('automaticReview');

export type ReviewAllowance = 'allowed' | 'switched-off' | 'daily-limit';

/**
 * Decides whether a paid review may run. The switch is checked on every attempt, so turning it
 * off also stops retries; only a first attempt counts against the daily limit. Call inside a
 * transaction before any write.
 */
export async function reserveAutomaticReview(
  transaction: Transaction,
  firstAttempt: boolean,
): Promise<ReviewAllowance> {
  const usage = getFirestore()
    .collection('reviewDailyUsage')
    .doc(new Date().toISOString().slice(0, 10));
  const [control, used] = await Promise.all([
    transaction.get(automaticReviewSwitch()),
    firstAttempt ? transaction.get(usage) : Promise.resolve(null),
  ]);
  if (control.data()?.enabled !== true) return 'switched-off';
  if (!used) return 'allowed';
  const count = (used.data()?.count as number | undefined) ?? 0;
  if (count >= DAILY_REVIEW_LIMIT) return 'daily-limit';
  transaction.set(usage, { count: count + 1, expiresAt: new Date(Date.now() + 2 * 86400000) });
  return 'allowed';
}

export async function automaticReviewEnabled() {
  return (await automaticReviewSwitch().get()).data()?.enabled === true;
}
