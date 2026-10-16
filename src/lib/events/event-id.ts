/** RFC 4122 UUID (any version nibble) for route param validation before hitting Postgres. */
const EVENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEventId(value: string): boolean {
  return EVENT_ID_PATTERN.test(value.trim());
}
