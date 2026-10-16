import { describe, expect, it } from "vitest";

import {
  acceptHostPromptLine,
  endedGatheringHostCopy,
  gatheringTimeHasPassed,
} from "@/domain/events/host-prompt-copy";

describe("host prompt copy", () => {
  it("ended gathering: host viewer sees thanks without name prefix", () => {
    expect(
      endedGatheringHostCopy({
        hostDisplayName: "Alex",
        hostUserId: "user-a",
        viewerUserId: "user-a",
      }),
    ).toBe("You hosted this hui — thanks for hosting.");
  });

  it("ended gathering: other viewers see who hosted", () => {
    expect(
      endedGatheringHostCopy({
        hostDisplayName: "Alex",
        hostUserId: "user-a",
        viewerUserId: "user-b",
      }),
    ).toBe("Alex hosted this hui.");
  });

  it("prompts to confirm hosting for upcoming gatherings", () => {
    expect(acceptHostPromptLine({ suggestedHostName: "Alex" })).toContain("down to host");
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
