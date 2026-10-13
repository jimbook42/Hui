import type { EventStatus } from "./types";

export type ParticipantPlaceView =
  | { kind: "known"; line: string }
  | { kind: "pending"; line: string };

/**
 * Place copy for the invitee flow. Uses event-level location only (never infers a host's private address).
 */
export function participantPlaceView(input: {
  eventStatus: EventStatus;
  eventLocation: string | null;
  acceptedHostDisplayName: string | null;
  hostingEnabled: boolean;
}): ParticipantPlaceView {
  const location = input.eventLocation?.trim() ?? "";
  if (location.length > 0) {
    return { kind: "known", line: location };
  }

  if (
    input.hostingEnabled &&
    input.acceptedHostDisplayName &&
    (input.eventStatus === "confirmed" || input.eventStatus === "completed")
  ) {
    return {
      kind: "known",
      line: `At ${input.acceptedHostDisplayName}'s place`,
    };
  }

  return { kind: "pending", line: "Still being worked out." };
}
