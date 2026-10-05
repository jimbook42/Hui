import { describe, expect, it } from "vitest";

import { inviteShareText, inviteShareTitle } from "./share";

describe("invite group terminology", () => {
  it("uses group language in share copy", () => {
    expect(inviteShareTitle("Smith family")).toBe("Join Smith family on Hui");
    expect(inviteShareText("Smith family")).toBe(
      "You're invited to join Smith family on Hui.",
    );
    expect(inviteShareText()).not.toMatch(/Hui group/i);
    expect(inviteShareText()).not.toMatch(/Join Hui/i);
  });
});
