import {
  addCadenceToDateOnly,
  compareDateOnly,
  isDateOnly,
  subtractDaysFromDateOnly,
} from "@/domain/recurrence/date-only";

export type RecurrenceCadence = {
  intervalUnit: "week" | "month";
  intervalCount: number;
  /** Nominal anchor for the first / baseline cycle (YYYY-MM-DD). */
  anchorDate: string;
};

export type GroupPlanningEventSnapshot = {
  id: string;
  status: string;
  planningTargetDate: string | null;
  startsAt: string | null;
  recurrenceSeriesId: string | null;
};

export type PlanningCyclePhase =
  | "not_recurring"
  | "not_due"
  | "planning_soon"
  | "ready_to_plan"
  | "planning_exists"
  | "hui_confirmed"
  | "completed";

export type GroupPlanningCycle = {
  cadence: RecurrenceCadence | null;
  planningLeadDays: number;
  nextTargetDate: string | null;
  planningOpensOn: string | null;
  phase: PlanningCyclePhase;
  /** Active hui blocking a new cycle proposal, if any. */
  blockingEventId: string | null;
  /** Nominal target for the open cycle when proposing (duplicate key). */
  cycleTargetDate: string | null;
};

export function cadenceFromParts(
  unit: string | null | undefined,
  count: number | null | undefined,
  anchor: string | null | undefined,
): RecurrenceCadence | null {
  if (unit !== "week" && unit !== "month") {
    return null;
  }
  if (count === null || count === undefined || count < 1) {
    return null;
  }
  if (!anchor || !isDateOnly(anchor)) {
    return null;
  }
  return { intervalUnit: unit, intervalCount: count, anchorDate: anchor };
}

/** Latest reference date for advancing the nominal cycle (completed > confirmed past > anchor). */
export function resolveCycleReferenceDate(
  events: GroupPlanningEventSnapshot[],
  anchorDate: string,
  todayDateOnly: string,
): string {
  let best = anchorDate;
  for (const event of events) {
    if (event.status === "cancelled") {
      continue;
    }
    const nominal =
      event.planningTargetDate ??
      (event.startsAt ? event.startsAt.slice(0, 10) : null);
    if (!nominal || !isDateOnly(nominal)) {
      continue;
    }
    if (event.status === "completed") {
      if (compareDateOnly(nominal, best) > 0) {
        best = nominal;
      }
      continue;
    }
    if (event.status === "confirmed" && compareDateOnly(nominal, todayDateOnly) < 0) {
      if (compareDateOnly(nominal, best) > 0) {
        best = nominal;
      }
    }
  }
  return best;
}

export function computeNextTargetDate(
  cadence: RecurrenceCadence,
  referenceDate: string,
  todayDateOnly: string,
): string {
  let cursor = referenceDate;
  let guard = 0;
  while (compareDateOnly(cursor, todayDateOnly) <= 0 && guard < 500) {
    cursor = addCadenceToDateOnly(cursor, cadence.intervalUnit, cadence.intervalCount);
    guard += 1;
  }
  return cursor;
}

function findBlockingEvent(
  events: GroupPlanningEventSnapshot[],
  targetDate: string | null,
): GroupPlanningEventSnapshot | null {
  const open = events.filter((event) => event.status !== "cancelled");
  if (open.length === 0) {
    return null;
  }
  if (targetDate) {
    const forTarget = open.find(
      (event) => event.planningTargetDate === targetDate,
    );
    if (forTarget) {
      return forTarget;
    }
  }
  const proposing = open.find((event) => event.status === "proposing");
  if (proposing) {
    return proposing;
  }
  const confirmed = open.find((event) => event.status === "confirmed");
  return confirmed ?? null;
}

export function deriveGroupPlanningCycle(input: {
  recurringEnabled: boolean;
  cadence: RecurrenceCadence | null;
  planningLeadDays: number;
  todayDateOnly: string;
  events: GroupPlanningEventSnapshot[];
}): GroupPlanningCycle {
  const leadDays = input.planningLeadDays >= 0 ? input.planningLeadDays : 14;

  if (!input.recurringEnabled || !input.cadence) {
    return {
      cadence: null,
      planningLeadDays: leadDays,
      nextTargetDate: null,
      planningOpensOn: null,
      phase: "not_recurring",
      blockingEventId: null,
      cycleTargetDate: null,
    };
  }

  const reference = resolveCycleReferenceDate(
    input.events,
    input.cadence.anchorDate,
    input.todayDateOnly,
  );
  const nextTarget = computeNextTargetDate(
    input.cadence,
    reference,
    input.todayDateOnly,
  );
  const planningOpens = subtractDaysFromDateOnly(nextTarget, leadDays);
  const blocker = findBlockingEvent(input.events, nextTarget);

  let phase: PlanningCyclePhase = "not_due";
  if (blocker) {
    if (blocker.status === "completed") {
      phase = "completed";
    } else if (blocker.status === "confirmed") {
      phase = "hui_confirmed";
    } else {
      phase = "planning_exists";
    }
  } else if (compareDateOnly(input.todayDateOnly, planningOpens) >= 0) {
    phase = "ready_to_plan";
  } else {
    const soonThreshold = subtractDaysFromDateOnly(planningOpens, 7);
    if (compareDateOnly(input.todayDateOnly, soonThreshold) >= 0) {
      phase = "planning_soon";
    } else {
      phase = "not_due";
    }
  }

  const cycleTargetDate =
    blocker?.planningTargetDate ??
    (phase === "ready_to_plan" || phase === "planning_soon" || phase === "not_due"
      ? nextTarget
      : null);

  return {
    cadence: input.cadence,
    planningLeadDays: leadDays,
    nextTargetDate: nextTarget,
    planningOpensOn: planningOpens,
    phase,
    blockingEventId: blocker?.id ?? null,
    cycleTargetDate: cycleTargetDate ?? nextTarget,
  };
}

export function shouldShowPlanNextCta(cycle: GroupPlanningCycle): boolean {
  return cycle.phase === "ready_to_plan" && cycle.blockingEventId === null;
}

export function proposalPrefillFromCycle(
  cycle: GroupPlanningCycle,
  groupName: string,
): {
  seriesTitle: string;
  startsOn: string;
  candidateDate: string;
  planningTargetDate: string | null;
} | null {
  if (!cycle.cadence || !cycle.cycleTargetDate) {
    return null;
  }
  return {
    seriesTitle: groupName,
    startsOn: cycle.cadence.anchorDate,
    candidateDate: cycle.cycleTargetDate,
    planningTargetDate: cycle.cycleTargetDate,
  };
}

export function formatCadenceLabel(cadence: RecurrenceCadence): string {
  const unitLabel = cadence.intervalUnit === "week" ? "week" : "month";
  if (cadence.intervalCount === 1) {
    return cadence.intervalUnit === "week" ? "Every week" : "Every month";
  }
  return `Every ${cadence.intervalCount} ${unitLabel}s`;
}
