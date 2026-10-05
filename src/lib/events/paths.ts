import type { EventAttentionKind } from "@/domain/events/attention";

export function eventDetailPath(eventId: string): string {
  return `/events/${eventId}`;
}

export function participantRespondPath(eventId: string): string {
  return `/events/${eventId}/respond`;
}

export function eventManagePath(eventId: string): string {
  return `/events/${eventId}/manage`;
}

/** Deep link into the event page section that matches a home attention item. */
export function eventAttentionPath(
  eventId: string,
  kind: Exclude<EventAttentionKind, "respond">,
): string {
  const hash =
    kind === "host" ? "host" : kind === "confirm" ? "scheduling" : "contributions";
  return `${eventDetailPath(eventId)}#${hash}`;
}
