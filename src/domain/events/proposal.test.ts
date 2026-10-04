import { describe, expect, it } from "vitest";

import {
  candidatesForRpc,
  mergeWallClockIntoCandidates,
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
        foodInvolvement: "unsure",
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
        foodInvolvement: "unsure",
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
        foodInvolvement: "unsure",
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
        foodInvolvement: "unsure",
      },
      baseOptions,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.location).toBe("Alex's place");
      expect(result.payload.recurrence).toBeNull();
    }
  });

  it("maps candidates to RPC snake_case keys", () => {
    const rpc = candidatesForRpc([
      {
        startsAt: "2026-10-31T23:00:00.000Z",
        endsAt: "2026-11-01T02:00:00.000Z",
      },
    ]);
    expect(rpc[0]).toEqual({
      starts_at: "2026-10-31T23:00:00.000Z",
      ends_at: "2026-11-01T02:00:00.000Z",
    });
  });

  it("valid payload includes RPC-shaped candidates", () => {
    const result = validateEventProposalDraft(
      {
        title: "Family dinner",
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
        foodInvolvement: "unsure",
      },
      baseOptions,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.candidates[0]).toHaveProperty("starts_at");
      expect(result.payload.candidates[0]).not.toHaveProperty("startsAt");
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
      expect(parsed.endsAt && parsed.endsAt > parsed.startsAt).toBe(true);
    }
  });

  it("treats the end time as optional", () => {
    const withoutEnd = parseWallClockCandidate("2026-10-31", "18:00", "", "Pacific/Auckland");
    expect(withoutEnd).not.toBeNull();
    expect(withoutEnd?.endsAt).toBeNull();
    expect(withoutEnd?.startsAt).toBe("2026-10-31T05:00:00.000Z");
  });

  it("still requires a start time and a valid date", () => {
    expect(parseWallClockCandidate("2026-10-31", "", "", "Pacific/Auckland")).toBeNull();
    expect(parseWallClockCandidate("", "18:00", "", "Pacific/Auckland")).toBeNull();
  });

  it("rejects an end that is not after the start", () => {
    expect(parseWallClockCandidate("2026-10-31", "18:00", "18:00", "Pacific/Auckland")).toBeNull();
    expect(parseWallClockCandidate("2026-10-31", "18:00", "17:00", "Pacific/Auckland")).toBeNull();
  });

  it("sends start-only candidates to the database with a null end", () => {
    const result = validateEventProposalDraft(
      {
        title: "Dinner",
        location: "",
        notes: "",
        eventKind: "one_off",
        recurrence: null,
        candidates: [{ startsAt: "2026-10-31T05:00:00.000Z", endsAt: null }],
        initialHostUserId: "suggest",
        foodInvolvement: "unsure",
      },
      baseOptions,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.candidates[0]).toEqual({
        starts_at: "2026-10-31T05:00:00.000Z",
        ends_at: null,
      });
    }
  });

  it("rejects duplicate start-only candidates", () => {
    const result = validateEventProposalDraft(
      {
        title: "Dinner",
        location: "",
        notes: "",
        eventKind: "one_off",
        recurrence: null,
        candidates: [
          { startsAt: "2026-10-31T05:00:00.000Z", endsAt: null },
          { startsAt: "2026-10-31T05:00:00.000Z", endsAt: null },
        ],
        initialHostUserId: "suggest",
        foodInvolvement: "unsure",
      },
      baseOptions,
    );
    expect(result.ok).toBe(false);
  });
});

describe("mergeWallClockIntoCandidates", () => {
  const candidate = {
    startsAt: "2026-10-31T05:00:00.000Z",
    endsAt: null as string | null,
  };

  it("adds a parsed time when the list is empty", () => {
    expect(mergeWallClockIntoCandidates([], candidate)).toEqual({
      candidates: [candidate],
    });
  });

  it("returns an error when there is no parsed time and no candidates", () => {
    const result = mergeWallClockIntoCandidates([], null);
    expect(result.error).toMatch(/valid date/i);
  });

  it("keeps existing candidates when the parsed time is a duplicate", () => {
    expect(mergeWallClockIntoCandidates([candidate], candidate)).toEqual({
      candidates: [candidate],
    });
  });

  it("appends a new candidate", () => {
    const other = { startsAt: "2026-11-01T05:00:00.000Z", endsAt: null };
    expect(mergeWallClockIntoCandidates([candidate], other)).toEqual({
      candidates: [candidate, other],
    });
  });
});
