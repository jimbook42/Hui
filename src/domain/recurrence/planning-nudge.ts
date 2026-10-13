import { compareDateOnly } from "@/domain/recurrence/date-only";
import type { GroupPlanningCycle } from "@/domain/recurrence/planning-cycle";
import { canProposeEvents } from "@/domain/events/permissions";
import type { MembershipRole } from "@/domain/groups/permissions";
import type { GroupSettingsRow } from "@/lib/groups/types";

export function planningCycleNudgeDedupeKey(
  groupId: string,
  nominalDate: string,
): string {
  return `planning_cycle_opens:${groupId}:${nominalDate}`;
}

/** True when the planning window is open and a nudge may be sent for this nominal cycle. */
export function shouldSendPlanningCycleNudge(input: {
  cycle: GroupPlanningCycle;
  todayDateOnly: string;
  recurrencePaused: boolean;
}): boolean {
  if (input.recurrencePaused) {
    return false;
  }
  if (input.cycle.phase !== "ready_to_plan") {
    return false;
  }
  if (input.cycle.blockingEventId !== null) {
    return false;
  }
  const nominal = input.cycle.nextTargetDate;
  const opens = input.cycle.planningOpensOn;
  if (!nominal || !opens) {
    return false;
  }
  return compareDateOnly(input.todayDateOnly, opens) >= 0;
}

export function planningCycleNudgeRecipients(
  settings: GroupSettingsRow,
  members: { userId: string; role: MembershipRole }[],
): string[] {
  const ids = new Set<string>();
  for (const member of members) {
    if (!canProposeEvents(member.role, settings)) {
      continue;
    }
    ids.add(member.userId);
  }
  return [...ids];
}
