import { describe, expect, it } from "vitest";

import type { HostAssignmentSnapshot } from "./types";

import { canAssignEventHost, canRequestHostSwap, canRespondToHostProposal } from "./permissions";

const proposedFor = (userId: string): HostAssignmentSnapshot => ({
  id: "p1",
  eventId: "e1",
  userId,
  status: "proposed",
  displayName: "Host",
  createdAt: "2026-01-01T00:00:00Z",
});

const acceptedFor = (userId: string): HostAssignmentSnapshot => ({
  id: "a1",
  eventId: "e1",
  userId,
  status: "accepted",
  displayName: "Host",
  createdAt: "2026-01-02T00:00:00Z",
});

describe("host permissions", () => {
  it("allows proposer and admins to assign on confirmed events only", () => {
    expect(canAssignEventHost("member", "user-1", "user-1", "confirmed")).toBe(true);
    expect(canAssignEventHost("admin", "user-2", "user-1", "confirmed")).toBe(true);
    expect(canAssignEventHost("member", "user-2", "user-1", "confirmed")).toBe(false);
    expect(canAssignEventHost("member", "user-1", "user-1", "proposing")).toBe(true);
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
    expect(canRespondToHostProposal("host-1", proposal, "proposing")).toBe(true);
  });

  it("lets proposed and accepted hosts request swap during coordination", () => {
    const proposed = [proposedFor("host-1")];
    expect(canRequestHostSwap("host-1", proposed, "proposing")).toBe(true);
    expect(canRequestHostSwap("other", proposed, "proposing")).toBe(false);

    const accepted = [acceptedFor("host-2")];
    expect(canRequestHostSwap("host-2", accepted, "proposing")).toBe(true);
    expect(canRequestHostSwap("other", accepted, "proposing")).toBe(false);
  });

  it("does not treat accepted host as able to respond to a proposal", () => {
    const accepted = [acceptedFor("host-2")];
    expect(canRespondToHostProposal("host-2", null, "proposing")).toBe(false);
    expect(canRequestHostSwap("host-2", accepted, "proposing")).toBe(true);
  });

  it("blocks swap requests outside coordination statuses", () => {
    expect(canRequestHostSwap("host-1", [proposedFor("host-1")], "cancelled")).toBe(false);
  });
});
