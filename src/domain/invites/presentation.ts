import { gatheringPlanningPhrase, type GatheringContext } from "@/domain/gathering/type";
import { formatDateOnlyDisplay } from "@/domain/recurrence/date-only";

export type InvitePlanningPreview = {
  eventId: string;
  eventTitle: string;
  status: string;
  planningTargetDate: string | null;
  gathering: GatheringContext;
};

export type InvitePreviewCopyInput = {
  inviterDisplayName: string | null;
  groupName: string;
  planning: InvitePlanningPreview | null;
  /** IANA timezone for formatting planning target only. */
  timeZone?: string;
};

export function inviteHeadline(input: InvitePreviewCopyInput): string {
  const group = input.groupName.trim();
  const inviter = input.inviterDisplayName?.trim();

  if (input.planning) {
    const phrase = gatheringPlanningPhrase({
      type: input.planning.gathering.type,
      customDescription: input.planning.gathering.customDescription,
      eventTitle: input.planning.gathering.eventTitle,
    });
    if (inviter) {
      return `${inviter} invited you to help plan ${phrase} with ${group}.`;
    }
    return `You're invited to help plan ${phrase} with ${group}.`;
  }

  if (inviter) {
    return `${inviter} invited you to join ${group}.`;
  }
  return `You're invited to join ${group}.`;
}

export function inviteSupportingLines(input: InvitePreviewCopyInput): string[] {
  const lines: string[] = [];

  if (input.planning?.planningTargetDate) {
    lines.push(
      `Planning for around ${formatDateOnlyDisplay(input.planning.planningTargetDate)} — not a confirmed date yet.`,
    );
  }

  lines.push(
    "Hui helps groups find a time that works, coordinate the details and keep everyone up to date.",
  );

  return lines;
}

export function invitePrimaryCtaLabel(groupName: string, hasActivePlanning: boolean): string {
  if (hasActivePlanning) {
    return "Join the planning";
  }
  const trimmed = groupName.trim();
  if (trimmed) {
    return `Join ${trimmed}`;
  }
  return "Join group";
}

export const INVITE_WHAT_IS_HUI = {
  title: "What is Hui?",
  body:
    "Hui helps groups find a time that works, coordinate the details and keep everyone up to date.",
} as const;
