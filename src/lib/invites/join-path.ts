/** Parse `/join/:token` paths from a post-auth `next` redirect. */
export function parseJoinPathFromNext(next: string): {
  token: string;
  focusEventId: string | null;
} | null {
  const trimmed = next.trim();
  const match = trimmed.match(/^\/join\/([^/?#]+)(?:\?([^#]*))?/);
  if (!match) {
    return null;
  }
  const token = decodeURIComponent(match[1]);
  const query = match[2] ?? "";
  const eventParam = query
    .split("&")
    .map((part) => part.split("="))
    .find(([key]) => key === "event");
  const focusEventId =
    eventParam?.[1] ? decodeURIComponent(eventParam[1]) : null;
  return { token, focusEventId };
}
