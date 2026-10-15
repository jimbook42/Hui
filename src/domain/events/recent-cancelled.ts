/** How long cancelled hui stay visible on list surfaces. */
export const RECENT_CANCELLED_WINDOW_DAYS = 30;

/** Cap cancelled rows merged into home/list loads (keeps request payloads bounded). */
export const RECENT_CANCELLED_LIST_CAP = 12;

export function recentCancelledCutoffIso(now: Date = new Date()): string {
  const cutoff = new Date(now.getTime() - RECENT_CANCELLED_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}
