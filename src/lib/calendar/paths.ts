export function eventCalendarIcsPath(eventId: string): string {
  return `/api/events/${eventId}/calendar.ics`;
}
