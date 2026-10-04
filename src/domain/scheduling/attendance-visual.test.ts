import { describe, expect, it } from "vitest";

import {
  attendanceVisualAccessibleLabel,
  countAttendance,
  rosterResponseToVisualState,
} from "./attendance-visual";

describe("rosterResponseToVisualState", () => {
  it("maps yes/no/maybe and pending", () => {
    expect(rosterResponseToVisualState("yes", true)).toBe("yes");
    expect(rosterResponseToVisualState("no", true)).toBe("no");
    expect(rosterResponseToVisualState("maybe", true)).toBe("maybe");
    expect(rosterResponseToVisualState("maybe", false)).toBe("pending");
    expect(rosterResponseToVisualState(null, true)).toBe("pending");
  });
});

describe("attendanceVisualAccessibleLabel", () => {
  it("uses product vocabulary without private notes", () => {
    expect(attendanceVisualAccessibleLabel("Alex", "yes")).toBe("Alex, can come");
    expect(attendanceVisualAccessibleLabel("Alex", "pending")).toBe(
      "Alex, no answer yet",
    );
  });
});

describe("countAttendance", () => {
  it("counts each state and collapses maybe when disabled", () => {
    const members = [{ response: "yes" as const }, { response: "maybe" as const }, { response: "no" as const }, { response: null }];
    expect(countAttendance(members, true)).toEqual({ yes: 1, maybe: 1, no: 1, pending: 1, total: 4 });
    expect(countAttendance(members, false)).toEqual({ yes: 1, maybe: 0, no: 1, pending: 2, total: 4 });
  });
});
