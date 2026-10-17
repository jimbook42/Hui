/** 15-minute buckets — must match `new_proposed_time_notify_bucket` in Postgres. */
export const NEW_PROPOSED_TIME_DEDUPE_WINDOW_SEC = 900;

export function newProposedTimeNotifyBucket(epochMs: number): string {
  return String(Math.floor(epochMs / 1000 / NEW_PROPOSED_TIME_DEDUPE_WINDOW_SEC));
}

export function newProposedTimeDedupeKey(
  eventId: string,
  memberUserId: string,
  bucket: string,
): string {
  return `new_proposed_time:${eventId}:${memberUserId}:${bucket}`;
}
