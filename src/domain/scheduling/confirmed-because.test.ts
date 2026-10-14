import { describe, expect, it } from "vitest";

import {
  formatConfirmedHeroStatusLine,
  formatConfirmedReasonLine,
} from "./confirmed-because";

describe("formatConfirmedReasonLine", () => {
  it("uses majority wording for majority-rule groups", () => {
    expect(formatConfirmedReasonLine("majority_active_members")).toBe("Confirmed by majority");
  });

  it("covers other consensus rules briefly", () => {
    expect(formatConfirmedReasonLine("all_active_members")).toBe("Confirmed by everyone");
    expect(formatConfirmedReasonLine("required_participants")).toBe(
      "Confirmed by required members",
    );
    expect(formatConfirmedReasonLine("minimum_attendees")).toBe("Confirmed");
  });
});

describe("formatConfirmedHeroStatusLine", () => {
  it("appends live attendance tallies", () => {
    expect(
      formatConfirmedHeroStatusLine({
        consensusRule: "majority_active_members",
        counts: { yes: 3, maybe: 0, pending: 1, no: 0, total: 4 },
        maybeResponsesEnabled: true,
      }),
    ).toBe("Confirmed by majority · 3 coming · 1 yet to answer");
  });
});
