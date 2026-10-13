/** When an invite URL names a gathering, try that hui before newer active ones. */
export function prioritizeInviteFocusEvent<T extends { id: string }>(
  events: T[],
  focusEventId: string | null | undefined,
): T[] {
  if (!focusEventId) {
    return events;
  }
  const match = events.find((row) => row.id === focusEventId);
  if (!match) {
    return events;
  }
  return [match, ...events.filter((row) => row.id !== focusEventId)];
}
