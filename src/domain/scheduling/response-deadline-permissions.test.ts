import { describe, expect, it } from "vitest";

import {
  canAdminPickEventTime,
  canEditEventResponseDeadline,
  canNudgeEventAvailability,
} from "./response-deadline-permissions";

describe("response-deadline-permissions", () => {
  const hostId = "host-1";
  const proposerId = "proposer-1";
  const memberId = "member-1";

  describe("canAdminPickEventTime", () => {
    it("allows group owners and admins while proposing", () => {
      expect(canAdminPickEventTime("proposing", "owner")).toBe(true);
      expect(canAdminPickEventTime("proposing", "admin")).toBe(true);
    });

    it("denies members and closed statuses", () => {
      expect(canAdminPickEventTime("proposing", "member")).toBe(false);
      expect(canAdminPickEventTime("confirmed", "owner")).toBe(false);
    });
  });

  describe("canEditEventResponseDeadline", () => {
    it("allows owners and admins", () => {
      expect(
        canEditEventResponseDeadline("proposing", "owner", memberId, proposerId, hostId),
      ).toBe(true);
      expect(
        canEditEventResponseDeadline("proposing", "admin", memberId, proposerId, hostId),
      ).toBe(true);
    });

    it("allows proposer and accepted host", () => {
      expect(
        canEditEventResponseDeadline("proposing", "member", proposerId, proposerId, hostId),
      ).toBe(true);
      expect(
        canEditEventResponseDeadline("proposing", "member", hostId, proposerId, hostId),
      ).toBe(true);
    });
  });

  describe("canNudgeEventAvailability", () => {
    it("matches deadline edit rules for owners and admins", () => {
      expect(
        canNudgeEventAvailability("proposing", "owner", memberId, proposerId, hostId),
      ).toBe(true);
      expect(
        canNudgeEventAvailability("proposing", "admin", memberId, proposerId, hostId),
      ).toBe(true);
      expect(
        canNudgeEventAvailability("confirmed", "owner", memberId, proposerId, hostId),
      ).toBe(false);
    });
  });
});
