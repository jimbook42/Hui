import { addCadenceToDateOnly } from "@/domain/recurrence/date-only";

import { pickOpenCycleNominalDate, type GroupPlanningCycle } from "./planning-cycle";

/** Default skip date: next open nominal that is not already skipped. */
export function pickDefaultSkipNominalDate(
  cycle: GroupPlanningCycle,
  skippedNominalDates: string[],
): string {
  const skipSet = new Set(skippedNominalDates);
  const start = pickOpenCycleNominalDate(cycle);
  if (!start) {
    return "";
  }
  if (!cycle.cadence) {
    return skipSet.has(start) ? "" : start;
  }

  let cursor = start;
  let guard = 0;
  while (skipSet.has(cursor) && guard < 500) {
    cursor = addCadenceToDateOnly(
      cursor,
      cycle.cadence.intervalUnit,
      cycle.cadence.intervalCount,
    );
    guard += 1;
  }
  return cursor;
}

export function friendlyPlanningSkipError(error: { code?: string; message: string }): string {
  const message = error.message.toLowerCase();
  if (
    error.code === "23505" ||
    message.includes("planning_skip_unique") ||
    message.includes("duplicate key")
  ) {
    return "That date is already skipped.";
  }
  if (message.includes("violates") && message.includes("constraint")) {
    return "That date could not be skipped. Try another date.";
  }
  return "That date could not be skipped. Try again.";
}
