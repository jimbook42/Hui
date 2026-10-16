import type { EventStatus } from "@/domain/events/types";

const FORMER_MEMBER_LABEL = "former member";

export function isFormerMemberDisplayName(displayName: string | null | undefined): boolean {
  return displayName?.trim().toLowerCase() === FORMER_MEMBER_LABEL;
}

/** Past-tense host line after the gathering has ended. */
export function endedGatheringHostCopy(input: {
  hostDisplayName: string;
  hostUserId: string;
  viewerUserId: string;
}): string {
  if (input.hostUserId === input.viewerUserId) {
    return "You hosted this hui — thanks for hosting.";
  }
  return `${input.hostDisplayName} hosted this hui.`;
}

/** Host accept prompt for an upcoming gathering (confirm hosting / place). */
export function acceptHostPromptLine(input: { suggestedHostName: string }): string {
  return `${input.suggestedHostName}, you are down to host — confirm where this hui happens before we lock it`;
}

export function gatheringTimeHasPassed(input: {
  status: EventStatus;
  startsAt: string | null;
  nowIso: string;
}): boolean {
  if (input.status === "completed") {
    return true;
  }
  if (input.startsAt && input.startsAt <= input.nowIso && input.status === "confirmed") {
    return true;
  }
  return false;
}
