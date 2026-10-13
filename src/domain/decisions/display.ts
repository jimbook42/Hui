import type { EventDecisionStatus } from "@/lib/decisions/types";

export type DecisionMemberRef = {
  userId: string;
  displayName: string;
};

export type DecisionOptionRow = {
  id: string;
  label: string;
  position: number;
};

export type DecisionResponseRow = {
  userId: string;
  optionId: string;
};

export type DecisionPollView = {
  id: string;
  question: string;
  status: EventDecisionStatus;
  options: Array<{
    id: string;
    label: string;
    count: number;
    voters: DecisionMemberRef[];
    isSelected: boolean;
  }>;
  responseCount: number;
  eligibleCount: number;
  viewerOptionId: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  selectedLabel: string | null;
};

export function buildDecisionPollView(input: {
  id: string;
  question: string;
  status: EventDecisionStatus;
  options: DecisionOptionRow[];
  responses: DecisionResponseRow[];
  members: DecisionMemberRef[];
  viewerUserId: string;
  selectedOptionId: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
}): DecisionPollView {
  const memberById = new Map(input.members.map((member) => [member.userId, member]));
  const votersByOption = new Map<string, DecisionMemberRef[]>();
  for (const option of input.options) {
    votersByOption.set(option.id, []);
  }
  for (const response of input.responses) {
    const member = memberById.get(response.userId);
    if (!member) continue;
    const list = votersByOption.get(response.optionId) ?? [];
    list.push(member);
    votersByOption.set(response.optionId, list);
  }

  const viewerResponse = input.responses.find((row) => row.userId === input.viewerUserId);
  const sortedOptions = [...input.options].sort((a, b) => a.position - b.position);
  const selectedLabel =
    input.selectedOptionId
      ? (sortedOptions.find((option) => option.id === input.selectedOptionId)?.label ?? null)
      : null;

  return {
    id: input.id,
    question: input.question,
    status: input.status,
    options: sortedOptions.map((option) => ({
      id: option.id,
      label: option.label,
      count: votersByOption.get(option.id)?.length ?? 0,
      voters: votersByOption.get(option.id) ?? [],
      isSelected: input.selectedOptionId === option.id,
    })),
    responseCount: input.responses.length,
    eligibleCount: input.members.length,
    viewerOptionId: viewerResponse?.optionId ?? null,
    decidedByName: input.decidedByName,
    decidedAt: input.decidedAt,
    selectedLabel,
  };
}

export function decisionNeedsViewerResponse(
  poll: DecisionPollView,
  canRespond: boolean,
): boolean {
  return canRespond && poll.status === "open" && poll.viewerOptionId === null;
}

export function openDecisionsNeedingResponse(
  polls: DecisionPollView[],
  canRespond: boolean,
): DecisionPollView[] {
  return polls.filter((poll) => decisionNeedsViewerResponse(poll, canRespond));
}
