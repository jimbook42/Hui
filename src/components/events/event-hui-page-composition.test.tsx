import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EventPageData } from "@/lib/events/event-page-data";

let mockPageData: EventPageData;

vi.mock("@/lib/events/event-page-data", () => ({
  loadEventPage: vi.fn(async () => mockPageData),
}));

vi.mock("@/app/events/scheduling-actions", () => ({
  addCandidateAction: vi.fn(),
  finaliseEventAction: vi.fn(),
  setAvailabilityResponseAction: vi.fn(),
  withdrawCandidateAction: vi.fn(),
}));

vi.mock("@/app/events/actions", () => ({
  updateEventAction: vi.fn(),
}));

vi.mock("@/lib/auth/server-session", () => ({
  getServerSupabase: vi.fn(async () => ({})),
}));

vi.mock("@/lib/events/reschedule-audit", () => ({
  getLatestRescheduleFrom: vi.fn(async () => null),
}));

vi.mock("@/app/hosts/actions", () => ({
  acceptHostProposalAction: vi.fn(),
  assignEventHostAction: vi.fn(),
}));

vi.mock("@/app/decisions/actions", () => ({
  createEventDecisionAction: vi.fn(),
  updateEventDecisionDraftAction: vi.fn(),
  cancelEventDecisionAction: vi.fn(),
  finalizeEventDecisionAction: vi.fn(),
  respondEventDecisionAction: vi.fn(),
}));

vi.mock("@/components/auth/auth-form", () => ({
  AuthForm: ({ children }: { children: React.ReactNode }) => <form>{children}</form>,
  AuthField: () => null,
}));

vi.mock("@/components/hui/gathering-visual", () => ({
  GatheringVisual: () => <div data-testid="gathering-visual" />,
}));

vi.mock("@/components/events/attendance-live", () => ({
  LiveGatheringVisual: () => <div data-testid="gathering-visual" />,
  ViewerResponseCard: () => null,
  AttendanceLiveProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/events/event-propose-invite-section", () => ({
  EventProposeInviteSection: () => (
    <div data-testid="invite-stub">
      <button type="button">Share invite</button>
      <button type="button">Copy link</button>
    </div>
  ),
}));

vi.mock("@/components/events/event-confirm-this-time-button", () => ({
  ConfirmThisTimeButton: () => <button type="button">Confirm this time</button>,
}));

vi.mock("@/components/hosts/host-swap-request-form", () => ({
  HostSwapRequestForm: () => <div data-testid="host-swap-form" />,
}));

vi.mock("@/components/hosts/accept-host-with-place-form", () => ({
  AcceptHostWithPlaceForm: () => <div data-testid="accept-host-form" />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/events/event-1",
  useSearchParams: () => new URLSearchParams(),
}));

import { EventHeroMeta } from "@/components/events/event-page-sections";
import { EventHuiPageSectionsResolved } from "@/components/events/event-hui-page-sections";
import {
  ORGANISER_ID,
  MEMBER_ID,
  HOST_ID,
  hostAssignmentSnapshot,
  baseScheduling,
  buildCandidate,
  buildDecisionBundle,
  buildDetail,
  buildPageData,
  decisionPollsFromBundles,
  forView,
} from "@/components/events/event-hui-page-test-fixtures";

function detailsForTitle(title: string | RegExp): HTMLDetailsElement {
  const heading = screen.getByText(title);
  const details = heading.closest("details");
  if (!details) {
    throw new Error(`No <details> for ${String(title)}`);
  }
  return details;
}

function expectCollapsed(details: HTMLDetailsElement) {
  expect(details).not.toHaveAttribute("open");
}

async function renderHuiComposition(
  detail: ReturnType<typeof buildDetail>,
  pageData: EventPageData,
  userId: string,
  justProposed = false,
) {
  mockPageData = pageData;
  const hero = EventHeroMeta({
    detail,
    userId,
    pageData,
    appOrigin: "https://hui.test",
  });
  const body = await EventHuiPageSectionsResolved({ detail, userId, justProposed });
  render(
    <div>
      {hero}
      {body}
    </div>,
  );
}

function assertCommonCompactLayout(options: {
  nextAction: string | RegExp | null;
  showPlanningHelp?: boolean;
  showOrganiserTools?: boolean;
  expectManageCancel?: boolean;
  expectManageDelete?: boolean;
  expectCompactTimes?: boolean;
}) {
  const summaryHeader = screen
    .getAllByRole("status")
    .find((node) => node.textContent?.includes("Next:") || node.textContent?.match(/Planning|Confirmed|Cancelled|Past hui/));
  expect(summaryHeader).toBeTruthy();
  if (options.nextAction && summaryHeader) {
    if (typeof options.nextAction === "string") {
      expect(summaryHeader).toHaveTextContent(`Next: ${options.nextAction}`);
    } else {
      expect(summaryHeader.textContent).toMatch(options.nextAction);
    }
  }
  expect(screen.queryByTestId("gathering-visual")).toBeNull();
  expect(screen.queryByText(/https:\/\/hui\.test/)).toBeNull();

  if (options.expectCompactTimes) {
    expect(screen.getAllByText(/\d+ can · \d+ can't/).length).toBeGreaterThan(0);
  }

  if (options.showPlanningHelp) {
    expectCollapsed(detailsForTitle("How planning works"));
  } else {
    expect(screen.queryByText("How planning works")).toBeNull();
  }

  if (options.showOrganiserTools) {
    const organiserDetails = detailsForTitle("Organiser tools");
    expectCollapsed(organiserDetails);
    if (options.expectManageCancel) {
      expect(within(organiserDetails).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    }
    if (options.expectManageDelete) {
      expect(within(organiserDetails).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    }
  } else {
    expect(screen.queryByText("Organiser tools")).toBeNull();
  }

  expectCollapsed(detailsForTitle("Details"));
}

describe("Event hui page composition", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockPageData = buildPageData();
  });

  describe.each([
    ["organiser", "organiser" as const],
    ["member", "member" as const],
  ])("%s view", (_label, view) => {
    it("proposing organiser-picks shows Confirm next action", async () => {
      const detail = buildDetail({ confirmRule: "organiser_picks" });
      const pageData = buildPageData({
        consensus: {
          ...buildPageData().consensus,
          confirmRule: "organiser_picks",
        },
        organiserPicksConfirm: view === "organiser" ? { candidateId: "c1" } : null,
        viewerResponse: view === "organiser" ? "available" : null,
        canRespond: view === "member",
      });
      const ctx = forView(view, detail, pageData);
      await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
      assertCommonCompactLayout({
        nextAction: view === "organiser" ? "Confirm" : "Answer times",
        showPlanningHelp: view === "organiser",
        showOrganiserTools: view === "organiser",
        expectManageCancel: view === "organiser",
        expectManageDelete: view === "organiser",
        expectCompactTimes: true,
      });
      if (view === "organiser") {
        expect(
          screen.getAllByRole("button", { name: "Confirm this time" }).length,
        ).toBeGreaterThan(0);
      }
    });

    it("proposing group vote prompts answer or review", async () => {
      const detail = buildDetail();
      const pageData = buildPageData({
        attention:
          view === "organiser"
            ? [{ kind: "confirm", title: "A time works", detail: "Confirm it." }]
            : [],
        viewerResponse: view === "member" ? null : "available",
        canRespond: view === "member",
        canFinalise: view === "organiser",
      });
      const ctx = forView(view, detail, pageData);
      await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
      assertCommonCompactLayout({
        nextAction: view === "member" ? "Answer times" : "Review times",
        showPlanningHelp: view === "organiser",
        showOrganiserTools: view === "organiser",
        expectManageCancel: view === "organiser",
        expectCompactTimes: true,
      });
    });

    it("confirmed hui shows confirmed status line", async () => {
      const selected = buildCandidate("c1", "2026-12-01T10:00:00.000Z", "selected");
      const detail = buildDetail({
        status: "confirmed",
        startsAt: selected.startsAt,
        confirmationMethod: "consensus",
      });
      const pageData = buildPageData({
        scheduling: { ...baseScheduling(), candidates: [selected] },
        isProposed: false,
        canRespond: false,
        anyCandidatePasses: true,
        counts: { yes: 2, maybe: 0, no: 0, pending: 0, total: 2 },
      });
      const ctx = forView(view, detail, pageData);
      await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
      assertCommonCompactLayout({
        nextAction: null,
        showOrganiserTools: view === "organiser",
        expectCompactTimes: true,
      });
      expect(screen.getByText(/^Confirmed:/)).toBeInTheDocument();
    });

    it("admin-picked confirmed shows Confirmed by admin in hero", async () => {
      const selected = buildCandidate("c1", "2026-12-01T10:00:00.000Z", "selected");
      const detail = buildDetail({
        status: "confirmed",
        startsAt: selected.startsAt,
        confirmationMethod: "admin",
      });
      const pageData = buildPageData({
        scheduling: { ...baseScheduling(), candidates: [selected] },
        isProposed: false,
        counts: { yes: 2, maybe: 0, no: 0, pending: 0, total: 2 },
        anyCandidatePasses: true,
      });
      const ctx = forView(view, detail, pageData);
      await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
      expect(screen.getByText(/Confirmed by admin/)).toBeInTheDocument();
    });

    it("cancelled hui shows cancelled notice", async () => {
      const detail = buildDetail({ status: "cancelled" });
      const pageData = buildPageData({
        scheduling: { ...baseScheduling(), candidates: [] },
        primaryCandidate: undefined,
        focusCandidate: undefined,
        isProposed: false,
        canRespond: false,
      });
      const ctx = forView(view, detail, {
        ...pageData,
        canAccessManage: false,
        canCreateDecisions: false,
        canManageDecisions: false,
      });
      await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
      expect(screen.getByText("This hui was cancelled.")).toBeInTheDocument();
      expect(screen.queryByText("Organiser tools")).toBeNull();
    });

    it("past hui shows Former member proposer and hosted wording", async () => {
      const selected = buildCandidate("c1", "2025-06-01T10:00:00.000Z", "selected");
      const detail = buildDetail({
        status: "completed",
        startsAt: selected.startsAt,
        creatorDisplayName: "Former member",
      });
      const pageData = buildPageData({
        scheduling: { ...baseScheduling(), candidates: [selected] },
        hostContext: {
          assignments: [],
          history: { entries: [], viewerCount: 0 },
          view: {
            acceptedHost: hostAssignmentSnapshot("host-gone", "Alex", "accepted"),
            pendingProposal: null,
            suggestion: null,
          },
        },
        acceptedHostUserId: "host-gone",
        isProposed: false,
        canRespond: false,
      });
      const ctx = forView(view, detail, pageData);
      await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
      expect(screen.getByText(/Proposed by Former member/)).toBeInTheDocument();
      expect(screen.getByText("This hui has happened.")).toBeInTheDocument();
      expect(screen.getByText("Alex hosted this hui.")).toBeInTheDocument();
    });

    it("open poll shows question and organiser tools for organiser only", async () => {
      const bundle = buildDecisionBundle("open", "Which dessert?");
      const detail = buildDetail();
      const base = buildPageData();
      const pageData = buildPageData({
        decisionBundles: [bundle],
        decisionPolls: decisionPollsFromBundles(
          [bundle],
          view === "organiser" ? ORGANISER_ID : MEMBER_ID,
          base.groupMembers,
        ),
        openDecisionNeedsResponse: view === "member",
        viewerResponse: view === "member" ? "available" : null,
        canRespond: view === "organiser",
        attention:
          view === "member"
            ? [{ kind: "decision", title: "Poll", detail: "Answer" }]
            : [],
      });
      const ctx = forView(view, detail, pageData);
      await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
      expect(screen.getAllByText("Which dessert?").length).toBeGreaterThan(0);
      assertCommonCompactLayout({
        nextAction: view === "member" ? "Answer poll" : "Answer times",
        showPlanningHelp: view === "organiser",
        showOrganiserTools: view === "organiser",
        expectCompactTimes: true,
      });
    });

    it("decided poll keeps question visible in details", async () => {
      const bundle = buildDecisionBundle("decided", "Cake or pie?");
      const detail = buildDetail({ status: "confirmed", startsAt: "2026-12-01T10:00:00.000Z" });
      const base = buildPageData();
      const pageData = buildPageData({
        scheduling: {
          ...baseScheduling(),
          candidates: [buildCandidate("c1", "2026-12-01T10:00:00.000Z", "selected")],
        },
        decisionBundles: [bundle],
        decisionPolls: decisionPollsFromBundles([bundle], ORGANISER_ID, base.groupMembers),
        isProposed: false,
      });
      const ctx = forView(view, detail, pageData);
      await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
      expect(screen.getByText("Cake or pie?")).toBeInTheDocument();
    });

    it("recurring hui shows recurrence in details", async () => {
      const detail = buildDetail({
        kind: "recurring",
        recurrenceSeries: {
          id: "series-1",
          title: "Family dinners",
          intervalUnit: "week",
          intervalCount: 6,
          startsOn: "2026-01-01",
          endsOn: null,
          archivedAt: null,
        },
      });
      const ctx = forView(view, detail, buildPageData());
      await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
      expect(screen.getByText(/Recurrence series/)).toBeInTheDocument();
      expect(screen.getByText(/Family dinners/)).toBeInTheDocument();
    });
  });

  describe("host states while proposing", () => {
    it.each([
      ["no host", { acceptedHost: null, pendingProposal: null, suggestion: null }, /No host yet/],
      [
        "suggested host",
        {
          acceptedHost: null,
          pendingProposal: hostAssignmentSnapshot(HOST_ID, "Alex", "proposed"),
          suggestion: null,
        },
        /Alex suggested/,
      ],
      [
        "accepted host",
        {
          acceptedHost: hostAssignmentSnapshot(HOST_ID, "Alex", "accepted"),
          pendingProposal: null,
          suggestion: null,
        },
        /Hosted by Alex/,
      ],
    ] as const)("organiser sees %s copy", async (_label, hostView, matcher) => {
      const detail = buildDetail();
      const pageData = buildPageData({
        hostContext: {
          assignments: [],
          history: { entries: [], viewerCount: 0 },
          view: hostView,
        },
        acceptedHostUserId: hostView.acceptedHost?.userId ?? null,
        pendingHostProposal: hostView.pendingProposal,
      });
      await renderHuiComposition(detail, pageData, ORGANISER_ID);
      expect(screen.getByText(matcher)).toBeInTheDocument();
      assertCommonCompactLayout({
        nextAction: "Answer times",
        showPlanningHelp: true,
        showOrganiserTools: true,
        expectCompactTimes: true,
      });
    });
  });

  it("signed-in non-responder member sees Answer times and no organiser tools", async () => {
    const detail = buildDetail();
    const pageData = buildPageData({
      viewerResponse: null,
      canRespond: true,
    });
    const ctx = forView("member", detail, pageData);
    await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
    assertCommonCompactLayout({
      nextAction: "Answer times",
      showOrganiserTools: false,
      expectCompactTimes: true,
    });
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("member does not see manage Cancel inside organiser tools when organiser-only flags are off", async () => {
    const detail = buildDetail();
    const pageData = buildPageData();
    const ctx = forView("member", detail, pageData);
    await renderHuiComposition(ctx.detail, ctx.pageData, ctx.userId);
    expect(screen.queryByText("Organiser tools")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });
});
