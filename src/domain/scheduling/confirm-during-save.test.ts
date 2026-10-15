import { describe, expect, it } from "vitest";

import {
  confirmedDuringSaveOtherAnswersLockedMessage,
  confirmedDuringSaveToast,
  isConfirmRaceNoRetryError,
  isSchedulingClosedDbError,
  resolveConfirmRaceAfterFailedSave,
  shouldRetryAvailabilitySaveAfterConfirmRace,
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

  it("only retries when the answer targeted the selected candidate", () => {
    expect(
      shouldRetryAvailabilitySaveAfterConfirmRace("a", "b"),
    ).toBe(false);
    expect(
      shouldRetryAvailabilitySaveAfterConfirmRace("a", "a"),
    ).toBe(true);
    expect(shouldRetryAvailabilitySaveAfterConfirmRace("a", null)).toBe(
      false,
    );
  });

  it("returns locked copy when save was for a different proposed time", () => {
    const selected = {
      id: "tue",
      startsAt: "2026-11-10T18:00:00.000Z",
      endsAt: null,
    };
    const state = resolveConfirmRaceAfterFailedSave({
      originalCandidateId: "thu",
      selected,
      timeZone: "Pacific/Auckland",
      retrySucceeded: false,
    });
    expect(state.message).toBeUndefined();
    expect(state.error).toBe(
      confirmedDuringSaveOtherAnswersLockedMessage(
        selected.startsAt,
        selected.endsAt,
        "Pacific/Auckland",
      ),
    );
    expect(state.error).toMatch(/can't change/i);
  });

  it("returns saved message when retry on selected candidate succeeds", () => {
    const selected = {
      id: "tue",
      startsAt: "2026-11-10T18:00:00.000Z",
      endsAt: null,
    };
    const state = resolveConfirmRaceAfterFailedSave({
      originalCandidateId: "tue",
      selected,
      timeZone: "Pacific/Auckland",
      retrySucceeded: true,
    });
    expect(state.message).toBe("Response saved.");
    expect(state.notice).toBe(
      confirmedDuringSaveToast(
        selected.startsAt,
        selected.endsAt,
        "Pacific/Auckland",
      ),
    );
    expect(state.confirmedCandidate?.id).toBe("tue");
  });

  it("flags confirm-race locked copy as non-retryable", () => {
    const message = confirmedDuringSaveOtherAnswersLockedMessage(
      "2026-11-10T18:00:00.000Z",
      null,
      "Pacific/Auckland",
    );
    expect(isConfirmRaceNoRetryError(message)).toBe(true);
    expect(isConfirmRaceNoRetryError("Network blip.")).toBe(false);
  });
});
