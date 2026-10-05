import { describe, expect, it } from "vitest";

import {
  canCreateEventDecisions,
  canEditOwnEventDecisionDraft,
  canManageEventDecisions,
  canRespondToEventDecisions,
} from "@/domain/decisions/permissions";

describe("decision permissions", () => {
  it("allows members to create while the hui is open for responses", () => {
    expect(canCreateEventDecisions("proposing")).toBe(true);
    expect(canCreateEventDecisions("confirmed")).toBe(true);
    expect(canCreateEventDecisions("completed")).toBe(false);
  });

  it("keeps administrative lifecycle on event managers only", () => {
    expect(
      canManageEventDecisions("member", "user-1", "user-2", "proposing"),
    ).toBe(false);
    expect(
      canManageEventDecisions("admin", "user-1", "user-2", "proposing"),
    ).toBe(true);
  });

  it("lets creators edit only untouched open decisions", () => {
    expect(
      canEditOwnEventDecisionDraft("user-1", "user-1", 0, "open"),
    ).toBe(true);
    expect(
      canEditOwnEventDecisionDraft("user-1", "user-1", 1, "open"),
    ).toBe(false);
    expect(
      canEditOwnEventDecisionDraft("user-1", "user-2", 0, "open"),
    ).toBe(false);
  });

  it("matches respond permission with create permission", () => {
    expect(canRespondToEventDecisions("proposing")).toBe(
      canCreateEventDecisions("proposing"),
    );
  });
});
