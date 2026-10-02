import { describe, expect, it } from "vitest";

import { canAssignEventHost, canRespondToHostProposal } from "./permissions";

describe("host permissions", () => {
  it("allows proposer and admins to assign on confirmed events only", () => {
    expect(canAssignEventHost("member", "user-1", "user-1", "confirmed")).toBe(true);
    expect(canAssignEventHost("admin", "user-2", "user-1", "confirmed")).toBe(true);
    expect(canAssignEventHost("member", "user-2", "user-1", "confirmed")).toBe(false);
    expect(canAssignEventHost("member", "user-1", "user-1", "proposing")).toBe(false);
    expect(canAssignEventHost("member", "user-1", "user-1", "cancelled")).toBe(false);
  });

  it("lets only the proposed host respond on confirmed events", () => {
    const proposal = {
      id: "p1",
      eventId: "e1",
      userId: "host-1",
      status: "proposed" as const,
      displayName: "Host",
      createdAt: "2026-01-01T00:00:00Z",
    };
    expect(canRespondToHostProposal("host-1", proposal, "confirmed")).toBe(true);
    expect(canRespondToHostProposal("other", proposal, "confirmed")).toBe(false);
    expect(canRespondToHostProposal("host-1", proposal, "proposing")).toBe(false);
  });
});
