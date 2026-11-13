import { distanceKm } from './geo.ts';
import { isOpenIncident, type IssueLocation, type PublicIncident } from './models.ts';
import type { CommunityPreferences } from './community.ts';

export const REVIEW_REMINDER_RADIUS_METRES = 200;
export const MAX_REVIEW_GEOFENCES = 18;
const DAY = 86400000;
export interface ReminderLedger {
  day: string;
  count: number;
  issues: Record<string, number>;
}
export function effectiveReminderPreferences(
  preferences: CommunityPreferences,
  devicePaused = false,
  backgroundPaused = false,
  pushPaused = false,
): CommunityPreferences {
  return {
    ...preferences,
    pushUpdates: preferences.pushUpdates && !pushPaused,
    nearbyAlerts: preferences.nearbyAlerts && !devicePaused,
    backgroundAlerts: preferences.backgroundAlerts && !devicePaused && !backgroundPaused,
  };
}
export function reminderDay(now: number) {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
export function eligibleReminder(
  issue: PublicIncident,
  preferences: CommunityPreferences,
  ownFixIds: string[],
) {
  return (
    preferences.nearbyAlerts &&
    isOpenIncident(issue) &&
    !!issue.location &&
    (issue.communityResolution?.status !== 'awaiting-confirmation' ||
      (preferences.reviewer && !ownFixIds.includes(issue.communityResolution.fixId)))
  );
}
export function nearbyReminderTargets(
  issues: PublicIncident[],
  centre: IssueLocation,
  preferences: CommunityPreferences,
  ownFixIds: string[],
) {
  return issues
    .filter(
      (issue) =>
        eligibleReminder(issue, preferences, ownFixIds) && distanceKm(centre, issue.location!) <= 5,
    )
    .sort((a, b) => distanceKm(centre, a.location!) - distanceKm(centre, b.location!))
    .slice(0, MAX_REVIEW_GEOFENCES);
}
export function maySendReminder(issueId: string, ledger: ReminderLedger, now = Date.now()) {
  return (
    (ledger.day !== reminderDay(now) || ledger.count < 3) &&
    (ledger.issues[issueId] === undefined || now - ledger.issues[issueId]! >= DAY)
  );
}
export function recordReminder(
  issueId: string,
  ledger: ReminderLedger,
  now = Date.now(),
): ReminderLedger {
  return {
    day: reminderDay(now),
    count: ledger.day === reminderDay(now) ? ledger.count + 1 : 1,
    issues: {
      ...Object.fromEntries(
        Object.entries(ledger.issues)
          .filter(([, at]) => now - at < 30 * DAY)
          .slice(-99),
      ),
      [issueId]: now,
    },
  };
}
