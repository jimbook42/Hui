import { describe, expect, it } from "vitest";

import { groupAttendanceByResponse } from "./attendance-roster";

describe("attendance roster", () => {
  it("surfaces shared decline reasons under can't come", () => {
    const groups = groupAttendanceByResponse(
      {
        maybeResponsesEnabled: true,
        members: [
          {
            userId: "1",
            displayName: "Alex",
            response: "no",
            declineReason: "Away that week",
          },
        ],
      },
      { showDeclineReasons: true },
    );
    const cant = groups.find((group) => group.label === "Can't come");
    expect(cant?.entries?.[0]?.declineReason).toBe("Away that week");
  });

  it("groups members by response without exposing private notes", () => {
    const groups = groupAttendanceByResponse({
      maybeResponsesEnabled: true,
      members: [
        { userId: "1", displayName: "Alex", response: "yes" },
        { userId: "2", displayName: "Sam", response: "no" },
        { userId: "3", displayName: "Jamie", response: "maybe" },
        { userId: "4", displayName: "Chen", response: null },
      ],
    });

    expect(groups).toEqual([
      { label: "Can come", names: ["Alex"] },
      { label: "Can't come", names: ["Sam"] },
      { label: "Could make it work", names: ["Jamie"] },
      { label: "Haven't responded", names: ["Chen"] },
    ]);
  });

  it("groups Former member rows from roster payload", () => {
    const groups = groupAttendanceByResponse({
      maybeResponsesEnabled: true,
      members: [
        { userId: "1", displayName: "Alex", response: "yes" },
        { userId: "2", displayName: "Former member", response: "yes" },
      ],
    });

    expect(groups[0]).toEqual({
      label: "Can come",
      names: ["Alex", "Former member"],
    });
  });

  it("includes late markers for organisers when requested", () => {
    const groups = groupAttendanceByResponse(
      {
        maybeResponsesEnabled: true,
        members: [
          { userId: "1", displayName: "Alex", response: "yes", submittedLate: true },
          { userId: "2", displayName: "Sam", response: "yes", submittedLate: false },
        ],
      },
      { showLateTags: true },
    );

    expect(groups[0]?.entries).toEqual([
      { displayName: "Alex", submittedLate: true, declineReason: null },
      { displayName: "Sam", submittedLate: false, declineReason: null },
    ]);
  });
});
