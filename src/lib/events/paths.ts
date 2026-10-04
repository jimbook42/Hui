export function eventDetailPath(eventId: string): string {
  return `/events/${eventId}`;
}

export function participantRespondPath(eventId: string): string {
  return `/events/${eventId}/respond`;
}
