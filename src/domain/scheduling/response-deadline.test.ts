import { describe, expect, it } from "vitest";

import {
  computeDefaultResponseDeadlineAt,
  deadlinePassedReplySummary,
  formatProposalDeadlineDefaultNote,
  isResponseDeadlinePassed,
  proposalReplyByPreviewLabel,
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

  it("defaults proposal deadlines to 48 hours in days copy", () => {
    const from = new Date("2026-10-15T10:00:00Z");
    const deadline = computeDefaultResponseDeadlineAt(from, null);
    expect(deadline.getTime() - from.getTime()).toBe(48 * 60 * 60 * 1000);
    expect(formatProposalDeadlineDefaultNote(null)).toBe("default: 2 days");
  });

  it("shows not set when propose flow leaves reply-by blank", () => {
    expect(proposalReplyByPreviewLabel(null, "Pacific/Auckland")).toBe("Not set");
  });

  it("formats a chosen reply-by in the propose preview", () => {
    const label = proposalReplyByPreviewLabel(
      "2026-10-17T06:28:00.000Z",
      "Pacific/Auckland",
    );
    expect(label).toMatch(/Reply by/);
  });
});
