import { describe, expect, it } from "vitest";

import {
  deadlinePassedReplySummary,
  isResponseDeadlinePassed,
  replyByDeadlineLabel,
} from "./response-deadline";

describe("response deadline copy", () => {
  it("formats reply-by label in group timezone", () => {
    expect(replyByDeadlineLabel("2026-11-20T18:00:00+13:00", "Pacific/Auckland")).toMatch(
      /Reply by/,
    );
  });

  it("detects when the deadline has passed", () => {
    expect(
      isResponseDeadlinePassed("2020-01-01T00:00:00Z", new Date("2026-01-01T00:00:00Z")),
    ).toBe(true);
    expect(
      isResponseDeadlinePassed("2030-01-01T00:00:00Z", new Date("2026-01-01T00:00:00Z")),
    ).toBe(false);
    expect(isResponseDeadlinePassed(null)).toBe(false);
  });

  it("summarises organiser reply counts", () => {
    expect(deadlinePassedReplySummary(2, 5)).toBe("Deadline passed: 2 of 5 replied");
  });
});
