import type { RecurrenceCadence } from "@/domain/recurrence/planning-cycle";

export type CadencePresetId = "weekly" | "fortnightly" | "monthly";

export type CadencePreset = {
  id: CadencePresetId;
  label: string;
  intervalUnit: "week" | "month";
  intervalCount: number;
};

export const FIRST_GROUP_CADENCE_PRESETS: CadencePreset[] = [
  { id: "weekly", label: "Weekly", intervalUnit: "week", intervalCount: 1 },
  { id: "fortnightly", label: "Fortnightly", intervalUnit: "week", intervalCount: 2 },
  { id: "monthly", label: "Monthly", intervalUnit: "month", intervalCount: 1 },
];

export function cadencePresetFromParts(
  intervalUnit: "week" | "month",
  intervalCount: number,
): CadencePresetId {
  if (intervalUnit === "week" && intervalCount === 2) {
    return "fortnightly";
  }
  if (intervalUnit === "week" && intervalCount === 1) {
    return "weekly";
  }
  return "monthly";
}

export function formatCadenceLabel(cadence: Pick<RecurrenceCadence, "intervalUnit" | "intervalCount">): string {
  if (cadence.intervalUnit === "week" && cadence.intervalCount === 2) {
    return "Every fortnight";
  }
  const unitLabel = cadence.intervalUnit === "week" ? "week" : "month";
  if (cadence.intervalCount === 1) {
    return cadence.intervalUnit === "week" ? "Every week" : "Every month";
  }
  return `Every ${cadence.intervalCount} ${unitLabel}s`;
}
