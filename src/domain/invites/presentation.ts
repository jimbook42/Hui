import { gatheringPlanningPhrase, type GatheringContext } from "@/domain/gathering/type";

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

function formatPlanningTargetDate(dateOnly: string, timeZone: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const instant = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone,
    day: "numeric",
    month: "long",
  }).format(instant);
}

export function inviteHeadline(input: InvitePreviewCopyInput): string {
  const group = input.groupName.trim();
  const inviter = input.inviterDisplayName?.trim();

  if (input.planning) {
    const phrase = gatheringPlanningPhrase({
      type: input.planning.gathering.type,
      customDescription: input.planning.gathering.customDescription,
      eventTitle: input.planning.eventTitle,
    });
    if (inviter) {
      return `${inviter} invited you to join ${group} for planning ${phrase}.`;
    }
    return `You're invited to join ${group} for planning ${phrase}.`;
  }

  if (inviter) {
    return `${inviter} invited you to join ${group}.`;
  }
  return `You're invited to join ${group}.`;
}

export function inviteSupportingLines(input: InvitePreviewCopyInput): string[] {
  const lines: string[] = [];

  if (input.planning?.planningTargetDate) {
    const tz = input.timeZone ?? "Pacific/Auckland";
    lines.push(
      `Planning for around ${formatPlanningTargetDate(input.planning.planningTargetDate, tz)} — not a confirmed date yet.`,
    );
  }

  lines.push(
    "Hui helps the group find a time that works and coordinate the details.",
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
    "Hui helps groups keep recurring gatherings happening without the back-and-forth of group chats. It helps everyone find a time, coordinate the details, and know when they need to act.",
} as const;
