import type { EventStatus } from "@/domain/events/types";
import type { AvailabilityChoice } from "@/domain/scheduling/types";

/** Things on an event page that are waiting on the viewer, in priority order. */
export type EventAttentionKind = "respond" | "host" | "confirm" | "contribute" | "decision";

export type EventAttentionFacts = {
  status: EventStatus;
  /** A time is on the table the viewer could answer. */
  hasCandidate: boolean;
  canRespond: boolean;
  viewerResponse: AvailabilityChoice | null;
  /** Viewer has a pending "please host" suggestion they can accept. */
  canAcceptHostProposal: boolean;
  /** Viewer may finalise and at least one time already meets the group's rules. */
  canConfirmTime: boolean;
  /** Active contribution categories nobody has claimed. */
  unclaimedContributionCount: number;
  canCoordinateContributions: boolean;
  viewerHasContribution: boolean;
  /** An open generic decision still needs this member's choice. */
  openDecisionNeedsResponse?: boolean;
  canRespondToDecisions?: boolean;
};

export type EventAttentionItem = {
  kind: EventAttentionKind;
  title: string;
  detail: string;
};

const CLOSED: EventStatus[] = ["cancelled", "completed", "draft"];

export function buildEventAttention(facts: EventAttentionFacts): EventAttentionItem[] {
  if (CLOSED.includes(facts.status)) {
    return [];
  }

  const items: EventAttentionItem[] = [];

  if (facts.canRespond && facts.hasCandidate && facts.viewerResponse === null) {
    items.push({
      kind: "respond",
      title: "Tell the group if you can make it",
      detail: "It takes a few taps.",
    });
  }

  if (facts.canAcceptHostProposal) {
    items.push({
      kind: "host",
      title: "You have been asked to host",
      detail: "Accept, or ask to swap.",
    });
  }

  if (facts.canConfirmTime) {
    items.push({
      kind: "confirm",
      title: "A time works for the group",
      detail: "You can confirm it.",
    });
  }

  if (
    facts.status === "confirmed" &&
    facts.canCoordinateContributions &&
    facts.unclaimedContributionCount > 0 &&
    !facts.viewerHasContribution
  ) {
    const n = facts.unclaimedContributionCount;
    items.push({
      kind: "contribute",
      title: n === 1 ? "1 thing still needs someone" : `${n} things still need someone`,
      detail: "Pick something to bring.",
    });
  }

  if (
    facts.openDecisionNeedsResponse &&
    (facts.canRespondToDecisions ?? true)
  ) {
    items.push({
      kind: "decision",
      title: "A poll needs your answer",
      detail: "Pick an option for this gathering.",
    });
  }

  return items;
}
