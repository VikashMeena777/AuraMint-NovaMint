/**
 * Plan constants shared by the server actions.
 *
 * Deliberately NOT a "use server" module: a Server Action file may only export async
 * functions, and these values are also useful to non-action modules.
 *
 * `PlanLimits.dailyEventsLimit` is `null` for premium users — "unlimited" is
 * represented as `null` (the UI's documented contract) instead of `Infinity` or an
 * arbitrary large number, so nothing can render `Infinity` or a fake quota.
 */

/** Events a free user may log per day. */
export const FREE_DAILY_EVENT_LIMIT = 5;

/** Sentinel returned for premium users: no daily quota. */
export const UNLIMITED_DAILY_EVENTS = null;
