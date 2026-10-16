import { describe, expect, it } from "vitest";

import { acceptHostPromptLine, gatheringTimeHasPassed } from "@/domain/events/host-prompt-copy";

describe("host prompt copy", () => {
  it("uses past tense when the gathering has ended", () => {
    expect(
      acceptHostPromptLine({ suggestedHostName: "Alex", gatheringEnded: true }),
    ).toBe("Alex, you hosted this hui — thanks for hosting.");
  });

  it("does not say down to host for past confirmed hui", () => {
    expect(
      acceptHostPromptLine({ suggestedHostName: "Alex", gatheringEnded: false }),
    ).toContain("down to host");
  });

  it("treats completed hui as ended", () => {
    expect(
      gatheringTimeHasPassed({
        status: "completed",
        startsAt: null,
        nowIso: "2026-10-16T10:00:00.000Z",
      }),
    ).toBe(true);
  });
});
