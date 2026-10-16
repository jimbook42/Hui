import { describe, expect, it } from "vitest";

import { buildHuiPageNextAction } from "./hui-page-next-action";

const base = {
  status: "proposing" as const,
  startsAt: null,
  endsAt: null,
  timeZone: "Pacific/Auckland",
  attention: [] as { kind: "confirm" | "respond" | "host" | "contribute" | "decision"; title: string; detail: string }[],
  canRespond: false,
  hasCandidate: true,
  viewerResponse: null,
  organiserPicksConfirm: null,
};

describe("buildHuiPageNextAction", () => {
  it("asks the viewer to answer times when they have not responded", () => {
    const result = buildHuiPageNextAction({
      ...base,
      canRespond: true,
    });
    expect(result.statusLine).toBe("Planning");
    expect(result.nextAction).toBe("Answer times");
  });

  it("prompts organiser confirm when a time is ready", () => {
    const result = buildHuiPageNextAction({
      ...base,
      attention: [{ kind: "confirm", title: "A time works", detail: "Confirm it." }],
      canRespond: false,
      viewerResponse: "available",
    });
    expect(result.nextAction).toBe("Review times");
  });

  it("shows confirmed time in the status line", () => {
    const result = buildHuiPageNextAction({
      ...base,
      status: "confirmed",
      startsAt: "2026-11-13T23:00:00.000Z",
      endsAt: null,
    });
    expect(result.statusLine).toMatch(/^Confirmed:/);
    expect(result.nextAction).toBeNull();
  });

  it("uses organiser pick confirm action", () => {
    const result = buildHuiPageNextAction({
      ...base,
      organiserPicksConfirm: { candidateId: "c1" },
      viewerResponse: "available",
    });
    expect(result.nextAction).toBe("Confirm");
  });
});
