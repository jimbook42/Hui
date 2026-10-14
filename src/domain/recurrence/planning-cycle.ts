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
  | "recurrence_paused"
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

export type CycleReference = {
  referenceDate: string;
  /** True when reference comes from a completed hui (next slot is one cadence after that nominal). */
  afterClosedCycle: boolean;
};

/** Latest reference date for advancing the nominal cycle (completed > confirmed past > anchor). */
export function resolveCycleReferenceDate(
  events: GroupPlanningEventSnapshot[],
  anchorDate: string,
  todayDateOnly: string,
): CycleReference {
  let best = anchorDate;
  let afterClosedCycle = false;
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
      if (compareDateOnly(nominal, best) >= 0) {
        best = nominal;
        afterClosedCycle = true;
      }
      continue;
    }
    if (event.status === "confirmed" && compareDateOnly(nominal, todayDateOnly) < 0) {
      if (compareDateOnly(nominal, best) > 0) {
        best = nominal;
      }
    }
  }
  return { referenceDate: best, afterClosedCycle };
}

function eventAtNominal(
  events: GroupPlanningEventSnapshot[],
  nominalDate: string,
): GroupPlanningEventSnapshot | null {
  return (
    events.find(
      (event) =>
        event.status !== "cancelled" &&
        event.planningTargetDate === nominalDate,
    ) ?? null
  );
}

/** Earliest cadence nominal that is not past, skipped, completed, or occupied by an open hui. */
export function findEarliestOpenNominalTarget(input: {
  cadence: RecurrenceCadence;
  todayDateOnly: string;
  events: GroupPlanningEventSnapshot[];
  skippedNominalDates?: string[];
}): string {
  const skipSet = new Set(input.skippedNominalDates ?? []);
  let cursor = input.cadence.anchorDate;
  let guard = 0;

  while (guard < 500) {
    if (compareDateOnly(cursor, input.todayDateOnly) < 0) {
      cursor = addCadenceToDateOnly(
        cursor,
        input.cadence.intervalUnit,
        input.cadence.intervalCount,
      );
      guard += 1;
      continue;
    }
    if (skipSet.has(cursor)) {
      cursor = addCadenceToDateOnly(
        cursor,
        input.cadence.intervalUnit,
        input.cadence.intervalCount,
      );
      guard += 1;
      continue;
    }
    const event = eventAtNominal(input.events, cursor);
    if (event?.status === "completed") {
      cursor = addCadenceToDateOnly(
        cursor,
        input.cadence.intervalUnit,
        input.cadence.intervalCount,
      );
      guard += 1;
      continue;
    }
    if (event && (event.status === "proposing" || event.status === "confirmed")) {
      cursor = addCadenceToDateOnly(
        cursor,
        input.cadence.intervalUnit,
        input.cadence.intervalCount,
      );
      guard += 1;
      continue;
    }
    return cursor;
  }

  throw new Error("unable to find an open nominal planning target");
}

export function computeNextTargetDate(
  cadence: RecurrenceCadence,
  referenceDate: string,
  todayDateOnly: string,
  afterClosedCycle = false,
): string {
  let cursor = referenceDate;
  if (afterClosedCycle) {
    cursor = addCadenceToDateOnly(cursor, cadence.intervalUnit, cadence.intervalCount);
  }
  let guard = 0;
  while (compareDateOnly(cursor, todayDateOnly) <= 0 && guard < 500) {
    cursor = addCadenceToDateOnly(cursor, cadence.intervalUnit, cadence.intervalCount);
    guard += 1;
  }
  return cursor;
}

/** Nominal date for the next open planning cycle (propose / skip default). */
export function pickOpenCycleNominalDate(cycle: GroupPlanningCycle): string | null {
  return cycle.nextTargetDate ?? cycle.cycleTargetDate;
}

/** Nominal date to show in recurring UX (may differ from next open slot while a hui is in flight). */
export function cycleDisplayTargetDate(cycle: GroupPlanningCycle): string | null {
  if (
    cycle.phase === "planning_exists" ||
    cycle.phase === "hui_confirmed"
  ) {
    return cycle.cycleTargetDate ?? cycle.nextTargetDate;
  }
  return cycle.nextTargetDate ?? cycle.cycleTargetDate;
}

function findBlockingEvent(
  events: GroupPlanningEventSnapshot[],
  targetDate: string | null,
): GroupPlanningEventSnapshot | null {
  const open = events.filter(
    (event) => event.status !== "cancelled" && event.status !== "completed",
  );
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
  skippedNominalDates?: string[];
  recurrencePaused?: boolean;
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

  if (input.recurrencePaused) {
    const nextTarget = findEarliestOpenNominalTarget({
      cadence: input.cadence,
      todayDateOnly: input.todayDateOnly,
      events: input.events,
      skippedNominalDates: input.skippedNominalDates,
    });
    const planningOpens = subtractDaysFromDateOnly(nextTarget, leadDays);
    return {
      cadence: input.cadence,
      planningLeadDays: leadDays,
      nextTargetDate: nextTarget,
      planningOpensOn: planningOpens,
      phase: "recurrence_paused",
      blockingEventId: null,
      cycleTargetDate: nextTarget,
    };
  }

  const nextTarget = findEarliestOpenNominalTarget({
    cadence: input.cadence,
    todayDateOnly: input.todayDateOnly,
    events: input.events,
    skippedNominalDates: input.skippedNominalDates,
  });
  const planningOpens = subtractDaysFromDateOnly(nextTarget, leadDays);
  const blocker = findBlockingEvent(input.events, nextTarget);

  let phase: PlanningCyclePhase = "not_due";
  if (blocker) {
    if (blocker.status === "confirmed") {
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
  const nominal = pickOpenCycleNominalDate(cycle);
  if (!cycle.cadence || !nominal) {
    return null;
  }
  return {
    seriesTitle: groupName,
    startsOn: cycle.cadence.anchorDate,
    candidateDate: nominal,
    planningTargetDate: nominal,
  };
}

export function shouldShowManualProposeLink(input: {
  canPropose: boolean;
  recurrencePaused: boolean;
  cycle: GroupPlanningCycle;
}): boolean {
  if (!input.canPropose || input.recurrencePaused) {
    return false;
  }
  if (
    input.cycle.phase === "recurrence_paused" ||
    input.cycle.phase === "planning_exists" ||
    input.cycle.phase === "hui_confirmed"
  ) {
    return false;
  }
  return !shouldShowPlanNextCta(input.cycle);
}

export { formatCadenceLabel } from "@/domain/recurrence/cadence-presets";
