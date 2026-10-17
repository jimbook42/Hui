import { formatShortDay, formatTimeSpan } from "@/domain/datetime/display";
import type { EventStatus } from "@/domain/events/types";
import type { EventAttentionItem } from "@/domain/events/attention";

export type HuiPageNextActionInput = {
  status: EventStatus;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  attention: EventAttentionItem[];
  canRespond: boolean;
  hasCandidate: boolean;
  viewerResponse: string | null;
  organiserPicksConfirm: unknown;
};

export type HuiPageNextAction = {
  statusLine: string;
  nextAction: string | null;
};

const STATUS_LINE: Partial<Record<EventStatus, string>> = {
  proposing: "Planning",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Past hui",
  draft: "Draft",
};

export function buildHuiPageNextAction(input: HuiPageNextActionInput): HuiPageNextAction {
  const statusLine =
    input.status === "confirmed" && input.startsAt
      ? `Confirmed: ${formatShortDay(input.startsAt, input.timeZone)} · ${formatTimeSpan(
          input.startsAt,
          input.endsAt,
          input.timeZone,
        )}`
      : (STATUS_LINE[input.status] ?? input.status);

  if (input.status === "cancelled" || input.status === "completed" || input.status === "draft") {
    return { statusLine, nextAction: null };
  }

  if (input.status === "confirmed") {
    return { statusLine, nextAction: null };
  }

  if (input.organiserPicksConfirm) {
    return { statusLine, nextAction: "Confirm" };
  }

  const confirmAttention = input.attention.find((item) => item.kind === "confirm");
  if (confirmAttention) {
    return { statusLine, nextAction: "Review times" };
  }

  if (
    input.canRespond &&
    input.hasCandidate &&
    input.viewerResponse === null
  ) {
    return { statusLine, nextAction: "Answer times" };
  }

  const hostAttention = input.attention.find((item) => item.kind === "host");
  if (hostAttention) {
    return { statusLine, nextAction: "Open hosting" };
  }

  const decisionAttention = input.attention.find((item) => item.kind === "decision");
  if (decisionAttention) {
    return { statusLine, nextAction: "Answer poll" };
  }

  const contributeAttention = input.attention.find((item) => item.kind === "contribute");
  if (contributeAttention) {
    return { statusLine, nextAction: "Pick something" };
  }

  if (input.viewerResponse !== null) {
    return { statusLine, nextAction: "Waiting on the group" };
  }

  return { statusLine, nextAction: null };
}
