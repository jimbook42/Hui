export function formatAvailabilityNudgeSuccessMessage(queued: number): string {
  if (queued <= 0) {
    return "Everyone has already answered a proposed time.";
  }
  if (queued === 1) {
    return "Nudge sent to 1 member who hasn't answered yet.";
  }
  return `Nudge sent to ${queued} members who haven't answered yet.`;
}
