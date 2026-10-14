export type StoredProposalCadence = {
  intervalUnit: "week" | "month";
  intervalCount: number;
};

function storageKey(groupId: string): string {
  return `hui.propose-cadence.${groupId}`;
}

export function readStoredProposalCadence(groupId: string): StoredProposalCadence | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(storageKey(groupId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredProposalCadence;
    if (
      (parsed.intervalUnit !== "week" && parsed.intervalUnit !== "month") ||
      typeof parsed.intervalCount !== "number" ||
      parsed.intervalCount < 1
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredProposalCadence(groupId: string, cadence: StoredProposalCadence): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(storageKey(groupId), JSON.stringify(cadence));
  } catch {
    // ignore quota / private mode
  }
}
