/** Builds the public join URL for a group invite token. */
export function buildGroupInviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/join/${token}`;
}

/** Invite tokens are URL-safe base64 fragments without group UUIDs. */
export function inviteUrlContainsNoGroupId(url: string, groupId: string): boolean {
  return !url.includes(groupId);
}
