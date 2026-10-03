import type { SupabaseClient } from "@supabase/supabase-js";

import type { MemberNotification, NotificationKind } from "./types";

type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  group_id: string;
  event_id: string | null;
  read_at: string | null;
  created_at: string;
  groups: unknown;
};

function readGroupTimeZone(groups: unknown): string | null {
  if (!groups || typeof groups !== "object") {
    return null;
  }
  const group = Array.isArray(groups) ? groups[0] : groups;
  if (!group || typeof group !== "object" || !("group_settings" in group)) {
    return null;
  }
  const settings = (group as { group_settings: unknown }).group_settings;
  const setting = Array.isArray(settings) ? settings[0] : settings;
  if (!setting || typeof setting !== "object" || !("timezone" in setting)) {
    return null;
  }
  const timeZone = (setting as { timezone: unknown }).timezone;
  return typeof timeZone === "string" && timeZone.length > 0 ? timeZone : null;
}

function mapRow(row: NotificationRow): MemberNotification {
  const timeZone = readGroupTimeZone(row.groups);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    groupId: row.group_id,
    eventId: row.event_id,
    readAt: row.read_at,
    createdAt: row.created_at,
    groupTimeZone:
      typeof timeZone === "string" && timeZone.length > 0 ? timeZone : "Pacific/Auckland",
  };
}

export async function syncReconnectReminders(
  supabase: SupabaseClient,
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("sync_reconnect_reminders_for_member");
  if (error) {
    return { error: error.message };
  }
  return {};
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("member_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function listMemberNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<MemberNotification[]> {
  const { data, error } = await supabase
    .from("member_notifications")
    .select(
      "id, kind, title, body, group_id, event_id, read_at, created_at, groups ( group_settings ( timezone ) )",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return (data as unknown as NotificationRow[]).map(mapRow);
}

export async function getMemberReconnectPreference(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("member_reconnect_reminders_enabled")
    .eq("id", userId)
    .maybeSingle();

  return data?.member_reconnect_reminders_enabled !== false;
}
