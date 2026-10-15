import { describe, expect, it } from "vitest";

import {
  ATTENDANCE_SAVE_CONNECTION_MESSAGE,
  attendanceActionErrorMessage,
  attendanceSaveCatchMessage,
  isAttendanceActionSuccess,
} from "@/domain/scheduling/availability-action-outcome";

describe("availability action outcome", () => {
  it("treats undefined and empty results as failure", () => {
    expect(isAttendanceActionSuccess(undefined)).toBe(false);
    expect(isAttendanceActionSuccess({})).toBe(false);
    expect(isAttendanceActionSuccess({ error: "nope" })).toBe(false);
  });

  it("accepts message or notice as success", () => {
    expect(isAttendanceActionSuccess({ message: "ok" })).toBe(true);
    expect(isAttendanceActionSuccess({ notice: "confirmed" })).toBe(true);
  });

  it("maps fetch failures to friendly copy", () => {
    expect(attendanceSaveCatchMessage(new Error("Failed to fetch"))).toBe(
      ATTENDANCE_SAVE_CONNECTION_MESSAGE,
    );
    expect(attendanceActionErrorMessage(undefined)).toBe(ATTENDANCE_SAVE_CONNECTION_MESSAGE);
  });
});
