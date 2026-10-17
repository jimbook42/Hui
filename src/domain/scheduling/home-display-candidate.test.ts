import { describe, expect, it } from "vitest";

import {
  homeShowsLeadingProposedTime,
  pickHomeDisplayCandidate,
} from "@/domain/scheduling/home-display-candidate";

const early = {
  id: "early",
  starts_at: "2026-11-13T23:00:00.000Z",
  status: "proposed" as const,
};
const late = {
  id: "late",
  starts_at: "2026-11-14T01:00:00.000Z",
  status: "proposed" as const,
};

describe("pickHomeDisplayCandidate", () => {
  it("prefers selected over proposed", () => {
    const picked = pickHomeDisplayCandidate(
      [early, { ...late, status: "selected" }],
      new Map([["early", 5], ["late", 1]]),
    );
    expect(picked?.id).toBe("late");
  });

  it("picks the time with the most can-come answers, then earliest on a tie", () => {
    const picked = pickHomeDisplayCandidate(
      [early, late],
      new Map([["early", 1], ["late", 3]]),
    );
    expect(picked?.id).toBe("late");
  });

  it("falls back to earliest proposed when nobody has said yes yet", () => {
    const picked = pickHomeDisplayCandidate([early, late], new Map());
    expect(picked?.id).toBe("early");
  });
});

describe("homeShowsLeadingProposedTime", () => {
  it("is true only when the picked slot leads on yes count", () => {
    const counts = new Map([["early", 1], ["late", 3]]);
    expect(homeShowsLeadingProposedTime([early, late], late, counts)).toBe(true);
    expect(homeShowsLeadingProposedTime([early, late], early, counts)).toBe(false);
    expect(homeShowsLeadingProposedTime([early], early, counts)).toBe(false);
    expect(homeShowsLeadingProposedTime([early, late], early, new Map())).toBe(false);
  });
});
