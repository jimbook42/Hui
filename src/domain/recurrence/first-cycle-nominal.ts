import type { RecurrenceCadence } from "@/domain/recurrence/planning-cycle";
import { findEarliestOpenNominalTarget } from "@/domain/recurrence/planning-cycle";

/** Default first-cycle nominal for a brand-new recurring group (anchor = planning target). */
export function firstGroupCycleNominalDate(
  cadence: Pick<RecurrenceCadence, "intervalUnit" | "intervalCount">,
  todayDateOnly: string,
): string {
  return findEarliestOpenNominalTarget({
    cadence: {
      intervalUnit: cadence.intervalUnit,
      intervalCount: cadence.intervalCount,
      anchorDate: todayDateOnly,
    },
    todayDateOnly,
    events: [],
    skippedNominalDates: [],
  });
}
