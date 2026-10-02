/** Whether a notification should target the acting member (usually skip). */
export function shouldSkipSelfNotification(
  recipientUserId: string,
  actorUserId: string | null | undefined,
): boolean {
  if (!actorUserId) {
    return false;
  }
  return recipientUserId === actorUserId;
}

export function eventProposedDedupeKey(eventId: string): string {
  return `event_proposed:${eventId}`;
}

export function consensusReadyDedupeKey(candidateId: string): string {
  return `consensus_ready:${candidateId}`;
}
