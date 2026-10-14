import { describe, expect, it } from "vitest";

import { participantSaveToastMessage } from "./participant-save-feedback";

describe("participantSaveToastMessage", () => {
  it("includes the answer and proposed time", () => {
    expect(participantSaveToastMessage("available", "Fri 6:30")).toBe("Saved");
  });

  it("uses neutral maybe and no wording", () => {
    expect(participantSaveToastMessage("maybe", "Sat lunch")).toBe("Saved");
    expect(participantSaveToastMessage("unavailable", "")).toBe("Saved");
  });
});
