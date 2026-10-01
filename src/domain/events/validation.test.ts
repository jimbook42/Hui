import { describe, expect, it } from "vitest";

import {
  normalizeEventTitle,
  parseEventKind,
  parseIntervalCount,
  parseStartsOnDate,
} from "./validation";

describe("event validation", () => {
  it("normalises titles within length bounds", () => {
    expect(normalizeEventTitle("  Potluck  ")).toBe("Potluck");
    expect(normalizeEventTitle("")).toBeNull();
    expect(normalizeEventTitle("a".repeat(161))).toBeNull();
  });

  it("parses event kind and recurrence fields", () => {
    expect(parseEventKind("one_off")).toBe("one_off");
    expect(parseEventKind("weekly")).toBeNull();
    expect(parseIntervalCount("2")).toBe(2);
    expect(parseIntervalCount("0")).toBeNull();
    expect(parseStartsOnDate("2026-11-01")).toBe("2026-11-01");
    expect(parseStartsOnDate("11/01/2026")).toBeNull();
  });
});
