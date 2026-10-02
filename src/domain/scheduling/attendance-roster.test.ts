import { describe, expect, it } from "vitest";

import { groupAttendanceByResponse } from "./attendance-roster";

describe("attendance roster", () => {
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
});
