import type { SupabaseClient } from "@supabase/supabase-js";

import { pickAcceptedHost, pickPendingHostProposal } from "@/domain/hosts/display";
import { buildHostHistory, suggestHost } from "@/domain/hosts/rotation";
import type { HostAssignmentSnapshot } from "@/domain/hosts/types";

import type { EventHostContext, GroupHostHistory } from "./types";

function mapAssignment(row: Record<string, unknown>): HostAssignmentSnapshot {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    userId: row.user_id as string,
    status: row.status as HostAssignmentSnapshot["status"],
    displayName: row.display_name as string,
    createdAt: row.created_at as string,
  };
}

export async function listEventHostAssignments(
  supabase: SupabaseClient,
  eventId: string,
): Promise<HostAssignmentSnapshot[]> {
  const { data, error } = await supabase
    .from("host_assignments")
    .select("id, event_id, user_id, status, display_name, created_at")
    .eq("event_id", eventId)
    .not("user_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapAssignment(row as Record<string, unknown>));
}

const HISTORY_EVENT_STATUSES = ["confirmed", "completed"] as const;

export async function getGroupHostHistory(
  supabase: SupabaseClient,
  groupId: string,
  viewerUserId: string,
): Promise<GroupHostHistory> {
  const { data, error } = await supabase
    .from("host_assignments")
    .select(
      `
      user_id,
      display_name,
      status,
      events!inner (
        status
      )
    `,
    )
    .eq("group_id", groupId)
    .eq("status", "accepted")
    .not("user_id", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []).filter((row) => {
    const rawEvent = row.events as { status: string } | { status: string }[] | null;
    const event = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
    return event && (HISTORY_EVENT_STATUSES as readonly string[]).includes(event.status);
  });

  const historyRows = rows.map((row) => ({
    userId: row.user_id as string,
    displayName: (row.display_name as string) ?? "Member",
  }));

  const entries = buildHostHistory(historyRows);
  const viewerCount = entries.find((e) => e.userId === viewerUserId)?.count ?? null;

  return { entries, viewerCount };
}

export type EventHostView = {
  acceptedHost: HostAssignmentSnapshot | null;
  pendingProposal: HostAssignmentSnapshot | null;
  suggestion: ReturnType<typeof suggestHost>;
};

export function buildEventHostView(
  assignments: HostAssignmentSnapshot[],
  eligibleMembers: { userId: string; displayName: string }[],
  history: GroupHostHistory,
): EventHostView {
  const acceptedHost = pickAcceptedHost(assignments);
  const pendingProposal = pickPendingHostProposal(assignments);
  const suggestion =
    acceptedHost || pendingProposal
      ? null
      : suggestHost(eligibleMembers, history.entries);

  return { acceptedHost, pendingProposal, suggestion };
}

export async function getEventHostContext(
  supabase: SupabaseClient,
  eventId: string,
  groupId: string,
  viewerUserId: string,
  eligibleMembers: { userId: string; displayName: string }[],
): Promise<EventHostContext & { view: EventHostView }> {
  const [assignments, history] = await Promise.all([
    listEventHostAssignments(supabase, eventId),
    getGroupHostHistory(supabase, groupId, viewerUserId),
  ]);

  const view = buildEventHostView(assignments, eligibleMembers, history);

  return { assignments, history, view };
}
