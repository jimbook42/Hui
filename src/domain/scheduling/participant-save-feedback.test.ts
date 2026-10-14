import { describe, expect, it } from "vitest";

import { participantSaveToastMessage } from "./participant-save-feedback";

describe("participantSaveToastMessage", () => {
  it("includes the answer and proposed time", () => {
    expect(participantSaveToastMessage("available", "Fri 6:30")).toBe(
      "Saved: you're a yes for Fri 6:30",
    );
  });

  it("uses neutral maybe and no wording", () => {
    expect(participantSaveToastMessage("maybe", "Sat lunch")).toMatch(/maybe/);
    expect(participantSaveToastMessage("unavailable", "")).toBe("Saved: you're a no");
  });
});
