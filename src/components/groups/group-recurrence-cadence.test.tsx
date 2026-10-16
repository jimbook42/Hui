import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/groups/planning-cycle-actions", () => ({
  updateGroupRecurrenceCadenceAction: vi.fn(),
}));

vi.mock("@/lib/ui/use-action-state-refresh", () => ({
  useActionStateRefresh: vi.fn(),
}));

import { GroupRecurrenceCadenceSection } from "./group-recurrence-cadence";
import type { GroupPlanningContext } from "@/lib/groups/planning-cycle-queries";

const context = {
  groupId: "g-1",
  groupName: "Friends",
  viewerRole: "admin" as const,
  settings: {} as GroupPlanningContext["settings"],
  canPropose: true,
  canManageRecurrence: true,
  recurrencePaused: false,
  showPlanCta: false,
  cycle: {
    cadence: { intervalUnit: "week", intervalCount: 1, anchorDate: "2026-10-01" },
    planningLeadDays: 14,
    nextTargetDate: "2026-10-26",
    planningOpensOn: "2026-10-12",
    phase: "ready_to_plan",
    blockingEventId: null,
    cycleTargetDate: "2026-10-26",
  },
  upcomingNominals: [
    { nominalDate: "2026-10-26", disposition: "next_open", skipReason: null },
  ],
  recentSkips: [],
} satisfies GroupPlanningContext;

describe("GroupRecurrenceCadenceSection copy", () => {
  it("uses plain wording instead of cadence jargon", () => {
    render(<GroupRecurrenceCadenceSection context={context} />);
    expect(screen.getByText("How often")).toBeInTheDocument();
    expect(screen.getAllByText("Starts from").length).toBeGreaterThan(0);
    expect(screen.getByText("Upcoming planned dates")).toBeInTheDocument();
    expect(screen.queryByText(/cadence/i)).toBeNull();
    expect(screen.queryByText(/nominal/i)).toBeNull();
    expect(screen.queryByText(/anchor date/i)).toBeNull();
  });
});
