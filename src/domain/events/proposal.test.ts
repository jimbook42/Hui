import { describe, expect, it } from "vitest";

import {
  parseWallClockCandidate,
  validateEventProposalDraft,
} from "@/domain/events/proposal";

describe("event proposal validation (HUI-026A)", () => {
  const baseOptions = {
    timeZone: "Pacific/Auckland",
    isFirstGroupEvent: false,
    hostingEnabled: true,
    memberUserIds: ["user-a", "user-b"],
  };

  it("rejects proposal without a name", () => {
    const result = validateEventProposalDraft(
      {
        title: "   ",
        location: "",
        notes: "",
        eventKind: "one_off",
        recurrence: null,
        candidates: [
          {
            startsAt: "2026-10-31T23:00:00.000Z",
            endsAt: "2026-11-01T02:00:00.000Z",
          },
        ],
        initialHostUserId: "suggest",
      },
      baseOptions,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/name/i);
    }
  });

  it("rejects proposal without candidates", () => {
    const result = validateEventProposalDraft(
      {
        title: "Family dinner",
        location: "",
        notes: "",
        eventKind: "one_off",
        recurrence: null,
        candidates: [],
        initialHostUserId: "suggest",
      },
      baseOptions,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/time/i);
    }
  });

  it("rejects invalid candidate windows", () => {
    const result = validateEventProposalDraft(
      {
        title: "Family dinner",
        location: "",
        notes: "",
        eventKind: "one_off",
        recurrence: null,
        candidates: [
          {
            startsAt: "2026-11-01T02:00:00.000Z",
            endsAt: "2026-10-31T23:00:00.000Z",
          },
        ],
        initialHostUserId: "suggest",
      },
      baseOptions,
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a valid one-off proposal payload", () => {
    const result = validateEventProposalDraft(
      {
        title: "Family dinner",
        location: "Alex's place",
        notes: "",
        eventKind: "one_off",
        recurrence: null,
        candidates: [
          {
            startsAt: "2026-10-31T23:00:00.000Z",
            endsAt: "2026-11-01T02:00:00.000Z",
          },
        ],
        initialHostUserId: "suggest",
      },
      baseOptions,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.location).toBe("Alex's place");
      expect(result.payload.recurrence).toBeNull();
    }
  });

  it("parses wall-clock candidate times in group timezone", () => {
    const parsed = parseWallClockCandidate(
      "2026-10-31",
      "12:00",
      "15:00",
      "Pacific/Auckland",
    );
    expect(parsed).not.toBeNull();
    if (parsed) {
      expect(parsed.endsAt > parsed.startsAt).toBe(true);
    }
  });
});
