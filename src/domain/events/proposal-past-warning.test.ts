import { describe, expect, it } from "vitest";

import { buildProposingPastDateWarning } from "@/domain/events/proposal-past-warning";

describe("buildProposingPastDateWarning", () => {
  it("does not repeat the unconfirmed auto-cancel phrase", () => {
    const warning = buildProposingPastDateWarning({
      draft: {
        candidates: [],
        recurrence: { planningTargetDate: "2026-10-01" },
      },
      timeZone: "Pacific/Auckland",
      todayDateOnly: "2026-10-14",
      nowIso: "2026-10-14T12:00:00.000Z",
      pendingDateOnly: "2026-10-01",
    });

    expect(warning).not.toBeNull();
    const detail = warning!.detail;
    expect(detail.match(/if it stays unconfirmed/g)?.length ?? 0).toBe(1);
    expect(detail).toContain("The planning date would be in the past —");
  });
});
