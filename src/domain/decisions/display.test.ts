import { describe, expect, it } from "vitest";

import {
  buildDecisionPollView,
  decisionNeedsViewerResponse,
  openDecisionsNeedingResponse,
} from "@/domain/decisions/display";

const members = [
  { userId: "u1", displayName: "Alex" },
  { userId: "u2", displayName: "Mia" },
];

describe("buildDecisionPollView", () => {
  it("tallies responses per option", () => {
    const poll = buildDecisionPollView({
      id: "d1",
      question: "Where?",
      status: "open",
      options: [
        { id: "o1", label: "A", position: 0 },
        { id: "o2", label: "B", position: 1 },
      ],
      responses: [
        { userId: "u1", optionId: "o1" },
        { userId: "u2", optionId: "o1" },
      ],
      members,
      viewerUserId: "u2",
      selectedOptionId: null,
      decidedByUserId: null,
      decidedAt: null,
      decidedByName: null,
    });
    expect(poll.options.find((option) => option.id === "o1")?.count).toBe(2);
    expect(poll.viewerOptionId).toBe("o1");
    expect(poll.responseCount).toBe(2);
  });
});

describe("decision attention helpers", () => {
  const openPoll = buildDecisionPollView({
    id: "d1",
    question: "Q",
    status: "open",
    options: [
      { id: "o1", label: "A", position: 0 },
      { id: "o2", label: "B", position: 1 },
    ],
    responses: [],
    members,
    viewerUserId: "u1",
    selectedOptionId: null,
    decidedByUserId: null,
    decidedAt: null,
    decidedByName: null,
  });

  it("flags unanswered open polls", () => {
    expect(decisionNeedsViewerResponse(openPoll, true)).toBe(true);
    expect(openDecisionsNeedingResponse([openPoll], true)).toHaveLength(1);
    expect(decisionNeedsViewerResponse(openPoll, false)).toBe(false);
  });
});
