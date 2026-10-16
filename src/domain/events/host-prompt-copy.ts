import type { EventStatus } from "@/domain/events/types";

const FORMER_MEMBER_LABEL = "former member";

export function isFormerMemberDisplayName(displayName: string | null | undefined): boolean {
  return displayName?.trim().toLowerCase() === FORMER_MEMBER_LABEL;
}

/** Host accept prompt when the gathering time has already passed. */
export function acceptHostPromptLine(input: {
  suggestedHostName: string;
  gatheringEnded: boolean;
}): string {
  if (input.gatheringEnded) {
    return `${input.suggestedHostName}, you hosted this hui — thanks for hosting.`;
  }
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
