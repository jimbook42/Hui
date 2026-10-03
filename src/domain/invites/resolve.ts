export type InviteResolveStatus = "valid" | "invalid" | "already_member";

export type InviteResolveResult =
  | { status: "invalid" }
  | { status: "valid"; groupId: string; groupName: string }
  | { status: "already_member"; groupId: string; groupName: string };

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
  if (!groupId || !groupName) {
    return { status: "invalid" };
  }

  if (status === "already_member") {
    return { status: "already_member", groupId, groupName };
  }
  if (status === "valid") {
    return { status: "valid", groupId, groupName };
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
