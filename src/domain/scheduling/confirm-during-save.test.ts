import { describe, expect, it } from "vitest";

import {
  confirmedDuringSaveToast,
  isSchedulingClosedDbError,
} from "./confirm-during-save";

describe("confirm-during-save recovery copy", () => {
  it("detects the database scheduling-closed error", () => {
    expect(
      isSchedulingClosedDbError("this event is no longer open for scheduling changes"),
    ).toBe(true);
    expect(isSchedulingClosedDbError("Event not found")).toBe(false);
  });

  it("formats the friendly toast with the confirmed time", () => {
    const toast = confirmedDuringSaveToast(
      "2026-11-01T18:00:00.000Z",
      null,
      "Pacific/Auckland",
    );
    expect(toast).toContain("just confirmed");
    expect(toast).toMatch(/saved/i);
  });
});
