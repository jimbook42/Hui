import { addCadenceToDateOnly, compareDateOnly } from "@/domain/recurrence/date-only";
import type {
  GroupPlanningCycle,
  GroupPlanningEventSnapshot,
  RecurrenceCadence,
} from "@/domain/recurrence/planning-cycle";
export type NominalPreviewDisposition =
  | "next_open"
  | "upcoming_open"
  | "skipped"
  | "planning"
  | "confirmed"
  | "completed";

export type NominalPreviewRow = {
  nominalDate: string;
  disposition: NominalPreviewDisposition;
  skipReason: string | null;
};

function eventForNominal(
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

function dispositionForEvent(
  event: GroupPlanningEventSnapshot,
): NominalPreviewDisposition {
  if (event.status === "confirmed") {
    return "confirmed";
  }
  if (event.status === "completed") {
    return "completed";
  }
  return "planning";
}

/** Read-only preview of the next nominal target dates on the cadence grid. */
export function buildNominalDatePreview(input: {
  cadence: RecurrenceCadence;
  cycle: GroupPlanningCycle;
  todayDateOnly: string;
  events: GroupPlanningEventSnapshot[];
  skippedNominalDates: string[];
  skipReasons: Record<string, string | null>;
  count?: number;
}): NominalPreviewRow[] {
  const count = input.count ?? 4;
  const skipSet = new Set(input.skippedNominalDates);
  let cursor = input.cadence.anchorDate;
  let alignGuard = 0;
  while (
    compareDateOnly(cursor, input.todayDateOnly) < 0 &&
    alignGuard < 500
  ) {
    cursor = addCadenceToDateOnly(
      cursor,
      input.cadence.intervalUnit,
      input.cadence.intervalCount,
    );
    alignGuard += 1;
  }

  const rows: NominalPreviewRow[] = [];
  let openSlots = 0;
  let guard = 0;

  while (rows.length < count && guard < 120) {
    if (skipSet.has(cursor)) {
      rows.push({
        nominalDate: cursor,
        disposition: "skipped",
        skipReason: input.skipReasons[cursor] ?? null,
      });
    } else {
      const event = eventForNominal(input.events, cursor);
      if (event) {
        rows.push({
          nominalDate: cursor,
          disposition: dispositionForEvent(event),
          skipReason: null,
        });
      } else {
        const disposition: NominalPreviewDisposition =
          openSlots === 0 ? "next_open" : "upcoming_open";
        rows.push({
          nominalDate: cursor,
          disposition,
          skipReason: null,
        });
        openSlots += 1;
      }
    }

    cursor = addCadenceToDateOnly(
      cursor,
      input.cadence.intervalUnit,
      input.cadence.intervalCount,
    );
    guard += 1;
  }

  return rows;
}
