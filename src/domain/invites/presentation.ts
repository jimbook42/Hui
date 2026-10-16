import { HUI_ONE_LINE_EXPLAINER } from "@/domain/events/hui-explainer";
import { gatheringPlanningPhrase, type GatheringContext } from "@/domain/gathering/type";
import { formatCompactEventTimeRange } from "@/domain/datetime/timezone";
import { formatDateOnlyDisplay } from "@/domain/recurrence/date-only";
import { formatShortDay, formatClockTime } from "@/domain/datetime/display";
import type { InviteProposedTime } from "@/domain/invites/resolve";

export type InvitePlanningPreview = {
  eventId: string;
  eventTitle: string;
  status: string;
  planningTargetDate: string | null;
  proposedStartsAt: string | null;
  proposedTimes?: InviteProposedTime[];
  gathering: GatheringContext;
};

export type InvitePreviewCopyInput = {
  inviterDisplayName: string | null;
  groupName: string;
  planning: InvitePlanningPreview | null;
  /** IANA timezone for formatting planning target only. */
  timeZone?: string;
};

export function formatInviteProposedTimes(
  times: InviteProposedTime[],
  timeZone: string,
): string[] {
  return times.map((row) => {
    const range = formatCompactEventTimeRange(row.startsAt, row.endsAt, timeZone);
    return `Proposed: ${range}`;
  });
}

export function invitePlanningDateLine(
  planning: InvitePlanningPreview,
  timeZone: string,
): string | null {
  if ((planning.proposedTimes ?? []).length > 0) {
    return null;
  }
  if (planning.proposedStartsAt) {
    const day = formatShortDay(planning.proposedStartsAt, timeZone);
    const time = formatClockTime(planning.proposedStartsAt, timeZone);
    return `Proposed time: ${day} · ${time}`;
  }
  if (planning.planningTargetDate) {
    return `Planning for around ${formatDateOnlyDisplay(planning.planningTargetDate)} — not a confirmed date yet.`;
  }
  return "Date still being worked out.";
}

function isDeletedInviterDisplayName(displayName: string | null | undefined): boolean {
  return displayName?.trim().toLowerCase() === "former member";
}

export function inviteHeadline(input: InvitePreviewCopyInput): string {
  const group = input.groupName.trim();
  const inviter = input.inviterDisplayName?.trim();
  const inviterIsDeleted = isDeletedInviterDisplayName(inviter);

  if (input.planning) {
    const phrase = gatheringPlanningPhrase({
      type: input.planning.gathering.type,
      customDescription: input.planning.gathering.customDescription,
      eventTitle: input.planning.gathering.eventTitle,
    });
    if (inviter && !inviterIsDeleted) {
      return `${inviter} invited you to help plan ${phrase} with ${group}.`;
    }
    if (inviterIsDeleted) {
      return `You were invited to help plan ${phrase} with ${group}.`;
    }
    return `You're invited to help plan ${phrase} with ${group}.`;
  }

  if (inviter && !inviterIsDeleted) {
    return `${inviter} invited you to join ${group}.`;
  }
  if (inviterIsDeleted) {
    return `You were invited to join ${group}.`;
  }
  return `You're invited to join ${group}.`;
}

export function inviteSupportingLines(input: InvitePreviewCopyInput): string[] {
  const lines: string[] = [];
  const group = input.groupName.trim();

  if (group) {
    lines.push(`Group: ${group}`);
  }

  if (input.planning) {
    lines.push(`Hui: ${input.planning.eventTitle}`);
    const tz = input.timeZone ?? "Pacific/Auckland";
    const proposedLines = formatInviteProposedTimes(input.planning.proposedTimes ?? [], tz);
    if (proposedLines.length > 0) {
      lines.push(...proposedLines);
    } else {
      const dateLine = invitePlanningDateLine(input.planning, tz);
      if (dateLine) {
        lines.push(dateLine);
      }
    }
  }

  return lines;
}

export function invitePrimaryCtaLabel(groupName: string, hasActivePlanning: boolean): string {
  if (hasActivePlanning) {
    return "Join and answer";
  }
  const trimmed = groupName.trim();
  if (trimmed) {
    return `Join ${trimmed}`;
  }
  return "Join group";
}

export const INVITE_WHAT_IS_HUI = {
  title: "What is a hui?",
  body: HUI_ONE_LINE_EXPLAINER,
} as const;
