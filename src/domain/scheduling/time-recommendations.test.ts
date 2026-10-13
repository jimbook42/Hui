import { describe, expect, it } from "vitest";

import { wallClockToUtcIso } from "@/domain/datetime/timezone";
import type { StandingAvailabilityWindow } from "@/domain/scheduling/standing-availability";
import {
  generateRecommendationCandidates,
  MAX_TIME_RECOMMENDATIONS,
  rankTimeRecommendations,
  recommendationPayloadIsAggregateOnly,
  resolveMemberSlotSignal,
  type MemberRecommendationProfile,
} from "@/domain/scheduling/time-recommendations";

const TZ = "Pacific/Auckland";

function window(
  dayOfWeek: number,
  start: number,
  end: number,
  kind: StandingAvailabilityWindow["kind"] = "usually_available",
): StandingAvailabilityWindow {
  return {
    id: `w-${dayOfWeek}-${start}`,
    groupId: "g1",
    dayOfWeek,
    startMinute: start,
    endMinute: end,
    kind,
  };
}

function member(
  userId: string,
  standing: StandingAvailabilityWindow[] = [],
): MemberRecommendationProfile {
  return { userId, standingWindows: standing };
}

function atLocal(date: string, time: string): string {
  const iso = wallClockToUtcIso(`${date}T${time}`, TZ);
  if (!iso) {
    throw new Error("bad fixture");
  }
  return iso;
}

describe("time recommendations (HUI-026)", () => {
  describe("event-specific availability precedence", () => {
    it("explicit yes outranks conflicting standing unavailability", () => {
      const thuEvening = atLocal("2026-10-15", "18:00");
      const m = member("u1", [window(4, 18 * 60, 22 * 60, "usually_unavailable")]);
      expect(
        resolveMemberSlotSignal(m, "yes", thuEvening, null, TZ),
      ).toBe("available");
    });

    it("explicit no prevents treating the member as available", () => {
      const thuEvening = atLocal("2026-10-15", "18:00");
      const m = member("u1", [window(4, 18 * 60, 22 * 60, "usually_available")]);
      expect(
        resolveMemberSlotSignal(m, "no", thuEvening, null, TZ),
      ).toBe("unavailable");
    });

    it("maybe follows group maybe setting", () => {
      const slot = atLocal("2026-10-15", "18:00");
      const m = member("u1");
      expect(resolveMemberSlotSignal(m, "maybe", slot, null, TZ, true)).toBe("maybe");
      expect(resolveMemberSlotSignal(m, "maybe", slot, null, TZ, false)).toBe("unknown");
    });

    it("unknown availability does not become unavailable", () => {
      const slot = atLocal("2026-10-15", "18:00");
      const m = member("u1");
      expect(resolveMemberSlotSignal(m, null, slot, null, TZ)).toBe("unknown");
    });
  });

  describe("standing availability", () => {
    it("contributes when event response is absent", () => {
      const thuEvening = atLocal("2026-10-15", "18:00");
      const m = member("u1", [window(4, 17 * 60, 21 * 60, "usually_available")]);
      expect(resolveMemberSlotSignal(m, null, thuEvening, null, TZ)).toBe("available");
    });

    it("does not auto-create attendance (ranking only)", () => {
      const recommendations = rankTimeRecommendations({
        memberCount: 2,
        members: [
          member("a", [window(4, 17 * 60, 21 * 60)]),
          member("b", [window(4, 17 * 60, 21 * 60)]),
        ],
        timeZone: TZ,
        planningTargetDate: "2026-10-15",
        todayDateOnly: "2026-10-01",
        existingCandidates: [],
        maybeResponsesEnabled: true,
      });
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendationPayloadIsAggregateOnly(recommendations)).toBe(true);
    });

    it("never returns per-user standing in the payload", () => {
      const recommendations = rankTimeRecommendations({
        memberCount: 1,
        members: [member("secret-user", [window(4, 17 * 60, 21 * 60)])],
        timeZone: TZ,
        planningTargetDate: "2026-10-15",
        todayDateOnly: "2026-10-01",
        existingCandidates: [],
        maybeResponsesEnabled: true,
      });
      expect(recommendationPayloadIsAggregateOnly(recommendations)).toBe(true);
      expect(JSON.stringify(recommendations)).not.toContain("secret-user");
    });
  });

  describe("ranking", () => {
    it("prefers broader group availability over conflicts", () => {
      const target = "2026-10-15";
      const good = rankTimeRecommendations({
        memberCount: 3,
        members: [
          member("a", [window(4, 17 * 60, 21 * 60)]),
          member("b", [window(4, 17 * 60, 21 * 60)]),
          member("c", [window(4, 17 * 60, 21 * 60)]),
        ],
        timeZone: TZ,
        planningTargetDate: target,
        todayDateOnly: "2026-10-01",
        existingCandidates: [],
        maybeResponsesEnabled: true,
      });
      const mixed = rankTimeRecommendations({
        memberCount: 3,
        members: [
          member("a", [window(4, 17 * 60, 21 * 60)]),
          member("b", [window(4, 17 * 60, 21 * 60, "usually_unavailable")]),
          member("c", [window(4, 17 * 60, 21 * 60, "usually_unavailable")]),
        ],
        timeZone: TZ,
        planningTargetDate: target,
        todayDateOnly: "2026-10-01",
        existingCandidates: [],
        maybeResponsesEnabled: true,
      });
      expect(good.length).toBeGreaterThan(0);
      expect(mixed.length).toBeLessThanOrEqual(good.length);
    });

    it("is deterministic", () => {
      const input = {
        memberCount: 2,
        members: [
          member("a", [window(4, 17 * 60, 21 * 60)]),
          member("b", [window(6, 17 * 60, 21 * 60)]),
        ],
        timeZone: TZ,
        planningTargetDate: "2026-10-15",
        todayDateOnly: "2026-10-01",
        existingCandidates: [],
        maybeResponsesEnabled: true,
      };
      const a = rankTimeRecommendations(input);
      const b = rankTimeRecommendations(input);
      expect(a).toEqual(b);
    });

    it("limits recommendations to the intended small number", () => {
      const recommendations = rankTimeRecommendations({
        memberCount: 4,
        members: [
          member("a", [window(0, 10 * 60, 22 * 60)]),
          member("b", [window(1, 10 * 60, 22 * 60)]),
          member("c", [window(2, 10 * 60, 22 * 60)]),
          member("d", [window(3, 10 * 60, 22 * 60)]),
        ],
        timeZone: TZ,
        planningTargetDate: "2026-10-15",
        todayDateOnly: "2026-10-01",
        existingCandidates: [],
        maybeResponsesEnabled: true,
      });
      expect(recommendations.length).toBeLessThanOrEqual(MAX_TIME_RECOMMENDATIONS);
    });

    it("keeps candidate generation inside the planning window", () => {
      const generated = generateRecommendationCandidates({
        planningTargetDate: "2026-10-15",
        todayDateOnly: "2026-10-01",
        timeZone: TZ,
      });
      for (const candidate of generated) {
        const date = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
          new Date(candidate.startsAt),
        );
        expect(date >= "2026-10-12" && date <= "2026-10-18").toBe(true);
      }
    });
  });

  describe("recurring planning", () => {
    it("uses planning target date in generation", () => {
      const aroundTarget = generateRecommendationCandidates({
        planningTargetDate: "2026-10-15",
        todayDateOnly: "2026-10-01",
        timeZone: TZ,
      });
      const dates = aroundTarget.map((c) =>
        new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(c.startsAt)),
      );
      expect(dates).toContain("2026-10-15");
    });
  });

  describe("no-data cases", () => {
    it("returns empty when no members", () => {
      expect(
        rankTimeRecommendations({
          memberCount: 0,
          members: [],
          timeZone: TZ,
          planningTargetDate: null,
          todayDateOnly: "2026-10-01",
          existingCandidates: [],
          maybeResponsesEnabled: true,
        }),
      ).toEqual([]);
    });

    it("returns empty when nobody has any signal", () => {
      expect(
        rankTimeRecommendations({
          memberCount: 2,
          members: [member("a"), member("b")],
          timeZone: TZ,
          planningTargetDate: null,
          todayDateOnly: "2026-10-01",
          existingCandidates: [],
          maybeResponsesEnabled: true,
        }),
      ).toEqual([]);
    });
  });

  describe("explicit responses on slots", () => {
    it("does not recommend strongly when explicit no conflicts with standing", () => {
      const slot = atLocal("2026-10-15", "18:00");
      const recommendations = rankTimeRecommendations({
        memberCount: 2,
        members: [member("a", [window(4, 17 * 60, 21 * 60)]), member("b")],
        timeZone: TZ,
        planningTargetDate: "2026-10-15",
        todayDateOnly: "2026-10-01",
        existingCandidates: [],
        maybeResponsesEnabled: true,
        eventResponseForSlot: (userId, candidate) => {
          if (userId === "a" && candidate.startsAt === slot) {
            return "no";
          }
          return null;
        },
      });
      const hit = recommendations.find((row) => row.startsAt === slot);
      expect(hit).toBeUndefined();
    });
  });
});
