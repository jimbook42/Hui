import { describe, expect, it } from "vitest";

import {
  attendanceVisualAccessibleLabel,
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
