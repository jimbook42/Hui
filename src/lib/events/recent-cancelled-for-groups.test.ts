import { describe, expect, it } from "vitest";

import {
  indexRecentCancelledByGroup,
  resolveCancelledEventStartsAt,
} from "@/lib/events/recent-cancelled-for-groups";

const NOW = new Date("2026-10-15T12:00:00.000Z");
const GROUP_ID = "33333333-3333-4333-8333-333333333333";

describe("resolveCancelledEventStartsAt", () => {
  it("uses confirmed starts_at when present", () => {
    expect(
      resolveCancelledEventStartsAt(
        { starts_at: "2026-11-12T06:00:00.000Z", planning_target_date: null },
        null,
      ),
    ).toBe("2026-11-12T06:00:00.000Z");
  });

  it("falls back to the earliest proposed candidate", () => {
    expect(
      resolveCancelledEventStartsAt(
        { starts_at: null, planning_target_date: null },
        "2026-11-12T06:00:00.000Z",
      ),
    ).toBe("2026-11-12T06:00:00.000Z");
  });
});

describe("indexRecentCancelledByGroup", () => {
  it("drops cancellations older than 30 days", () => {
    const byGroup = indexRecentCancelledByGroup(
      [
        {
          id: "old",
          title: "Old picnic",
          group_id: GROUP_ID,
          starts_at: "2025-06-01T05:00:00.000Z",
          timezone: "Pacific/Auckland",
          cancelled_at: "2025-09-01T12:00:00.000Z",
          planning_target_date: null,
        },
        {
          id: "recent",
          title: "Recent dinner",
          group_id: GROUP_ID,
          starts_at: "2026-10-12T05:00:00.000Z",
          timezone: "Pacific/Auckland",
          cancelled_at: "2026-10-10T12:00:00.000Z",
          planning_target_date: null,
        },
      ],
      NOW,
    );

    const list = byGroup.get(GROUP_ID) ?? [];
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe("Recent dinner");
  });

  it("keeps at most two per group, most recently cancelled first", () => {
    const byGroup = indexRecentCancelledByGroup(
      [
        {
          id: "a",
          title: "First",
          group_id: GROUP_ID,
          starts_at: null,
          timezone: null,
          cancelled_at: "2026-10-08T12:00:00.000Z",
          planning_target_date: null,
        },
        {
          id: "b",
          title: "Second",
          group_id: GROUP_ID,
          starts_at: null,
          timezone: null,
          cancelled_at: "2026-10-12T12:00:00.000Z",
          planning_target_date: null,
        },
        {
          id: "c",
          title: "Third",
          group_id: GROUP_ID,
          starts_at: null,
          timezone: null,
          cancelled_at: "2026-10-14T12:00:00.000Z",
          planning_target_date: null,
        },
      ],
      NOW,
    );

    const list = byGroup.get(GROUP_ID) ?? [];
    expect(list.map((row) => row.title)).toEqual(["Third", "Second"]);
  });

  it("uses proposed candidate times when events.starts_at is null", () => {
    const byGroup = indexRecentCancelledByGroup(
      [
        {
          id: "proposing-cancelled",
          title: "R7 OrgPicksHost",
          group_id: GROUP_ID,
          starts_at: null,
          timezone: "Pacific/Auckland",
          cancelled_at: "2026-10-14T12:00:00.000Z",
          planning_target_date: null,
        },
      ],
      NOW,
      2,
      new Map([["proposing-cancelled", "2026-11-12T06:00:00.000Z"]]),
    );

    const list = byGroup.get(GROUP_ID) ?? [];
    expect(list[0]?.startsAt).toBe("2026-11-12T06:00:00.000Z");
  });
});
