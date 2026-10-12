import { describe, expect, it } from "vitest";

import { prioritizeInviteFocusEvent } from "@/domain/invites/focus-event";

describe("prioritizeInviteFocusEvent", () => {
  const events = [
    { id: "newer", status: "proposing" },
    { id: "older", status: "proposing" },
  ];

  it("puts the invite focus gathering first when it is among active events", () => {
    const ordered = prioritizeInviteFocusEvent(events, "older");
    expect(ordered.map((row) => row.id)).toEqual(["older", "newer"]);
  });

  it("leaves order unchanged when no focus is provided", () => {
    expect(prioritizeInviteFocusEvent(events, null)).toEqual(events);
  });
});
