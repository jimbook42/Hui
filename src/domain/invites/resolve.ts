import { parseGatheringType, type GatheringType } from "@/domain/gathering/type";

export type InviteResolveStatus = "valid" | "invalid" | "already_member";

export type InviteProposedTime = {
  startsAt: string;
  endsAt: string | null;
};

export type InvitePlanningContext = {
  eventId: string;
  eventTitle: string;
  status: string;
  planningTargetDate: string | null;
  proposedStartsAt: string | null;
  proposedTimes: InviteProposedTime[];
  gatheringType: GatheringType | null;
  gatheringTypeCustom: string | null;
};

export type InviteResolveResult =
  | { status: "invalid" }
  | {
      status: "valid";
      groupId: string;
      groupName: string;
      groupTimeZone: string;
      inviterDisplayName: string | null;
      planning: InvitePlanningContext | null;
    }
  | {
      status: "already_member";
      groupId: string;
      groupName: string;
      groupTimeZone: string;
      inviterDisplayName: string | null;
      planning: InvitePlanningContext | null;
    };

function parseInvitePlanning(record: Record<string, unknown>): InvitePlanningContext | null {
  const planning = record.planning;
  if (!planning || typeof planning !== "object") {
    return null;
  }
  const p = planning as Record<string, unknown>;
  const eventId = typeof p.eventId === "string" ? p.eventId : "";
  const eventTitle = typeof p.eventTitle === "string" ? p.eventTitle : "";
  const status = typeof p.status === "string" ? p.status : "";
  if (!eventId || !eventTitle) {
    return null;
  }
  const planningTargetDate =
    typeof p.planningTargetDate === "string" ? p.planningTargetDate : null;
  const proposedStartsAt =
    typeof p.proposedStartsAt === "string" ? p.proposedStartsAt : null;
  const proposedTimes: InviteProposedTime[] = [];
  const rawTimes = p.proposedTimes;
  if (Array.isArray(rawTimes)) {
    for (const row of rawTimes) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const record = row as Record<string, unknown>;
      const startsAt = typeof record.startsAt === "string" ? record.startsAt : "";
      if (!startsAt) {
        continue;
      }
      const endsAt = typeof record.endsAt === "string" ? record.endsAt : null;
      proposedTimes.push({ startsAt, endsAt });
    }
  }
  const gatheringType = parseGatheringType(p.gatheringType);
  const gatheringTypeCustom =
    typeof p.gatheringTypeCustom === "string" ? p.gatheringTypeCustom : null;
  return {
    eventId,
    eventTitle,
    status,
    planningTargetDate,
    proposedStartsAt,
    proposedTimes,
    gatheringType,
    gatheringTypeCustom,
  };
}

export function parseInviteResolvePayload(
  payload: unknown,
): InviteResolveResult {
  if (!payload || typeof payload !== "object") {
    return { status: "invalid" };
  }

  const record = payload as Record<string, unknown>;
  const status = record.status;
  if (status === "invalid") {
    return { status: "invalid" };
  }

  const groupId = typeof record.groupId === "string" ? record.groupId : "";
  const groupName = typeof record.groupName === "string" ? record.groupName : "";
  const inviterDisplayName =
    typeof record.inviterDisplayName === "string" ? record.inviterDisplayName : null;
  const groupTimeZone =
    typeof record.groupTimeZone === "string" && record.groupTimeZone.trim()
      ? record.groupTimeZone.trim()
      : "Pacific/Auckland";
  const planning = parseInvitePlanning(record);
  if (!groupId || !groupName) {
    return { status: "invalid" };
  }

  if (status === "already_member") {
    return {
      status: "already_member",
      groupId,
      groupName,
      groupTimeZone,
      inviterDisplayName,
      planning,
    };
  }
  if (status === "valid") {
    return {
      status: "valid",
      groupId,
      groupName,
      groupTimeZone,
      inviterDisplayName,
      planning,
    };
  }

  return { status: "invalid" };
}

export type InviteJoinResult =
  | { status: "invalid" }
  | { status: "joined"; groupId: string }
  | { status: "already_member"; groupId: string };

export function parseInviteJoinPayload(payload: unknown): InviteJoinResult {
  if (!payload || typeof payload !== "object") {
    return { status: "invalid" };
  }

  const record = payload as Record<string, unknown>;
  const status = record.status;
  const groupId = typeof record.groupId === "string" ? record.groupId : "";

  if (status === "invalid" || !groupId) {
    if (status === "invalid") {
      return { status: "invalid" };
    }
    return { status: "invalid" };
  }

  if (status === "joined") {
    return { status: "joined", groupId };
  }
  if (status === "already_member") {
    return { status: "already_member", groupId };
  }

  return { status: "invalid" };
}
