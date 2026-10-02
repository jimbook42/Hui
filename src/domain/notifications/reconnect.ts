/** Group activity timestamp used for reconnect reminders (matches sync RPC). */
export function groupLastActivityAt(
  eventTimestamps: (Date | string | null)[],
  groupCreatedAt: Date | string,
): Date {
  let latest = new Date(groupCreatedAt).getTime();
  for (const value of eventTimestamps) {
    if (value == null) {
      continue;
    }
    const ms = new Date(value).getTime();
    if (Number.isFinite(ms) && ms > latest) {
      latest = ms;
    }
  }
  return new Date(latest);
}

export function isReconnectReminderDue(
  lastActivity: Date,
  reconnectAfterDays: number,
  now: Date,
): boolean {
  if (!Number.isFinite(reconnectAfterDays) || reconnectAfterDays < 1) {
    return false;
  }
  const thresholdMs = reconnectAfterDays * 24 * 60 * 60 * 1000;
  return now.getTime() - lastActivity.getTime() >= thresholdMs;
}

export function reconnectDedupeKey(groupId: string, lastActivity: Date): string {
  const day = lastActivity.toISOString().slice(0, 10);
  return `reconnect:${groupId}:${day}`;
}
