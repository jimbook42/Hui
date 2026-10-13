const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isInviteFocusEventId(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Builds the public join URL for a group invite token. */
export function buildGroupInviteUrl(
  origin: string,
  token: string,
  options?: { focusEventId?: string | null },
): string {
  const base = origin.replace(/\/$/, "");
  const path = `${base}/join/${token}`;
  const focusEventId = options?.focusEventId?.trim();
  if (focusEventId && isInviteFocusEventId(focusEventId)) {
    return `${path}?event=${encodeURIComponent(focusEventId)}`;
  }
  return path;
}

/** Invite tokens are URL-safe base64 fragments without group UUIDs. */
export function inviteUrlContainsNoGroupId(url: string, groupId: string): boolean {
  return !url.includes(groupId);
}
