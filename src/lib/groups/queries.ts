import type { SupabaseClient } from "@supabase/supabase-js";

import type { MembershipRole } from "@/domain/groups/permissions";

import type { GroupDetail, GroupListItem, GroupSettingsRow } from "./types";

function mapSettings(row: Record<string, unknown>): GroupSettingsRow {
  return {
    whoMayPropose: row.who_may_propose as GroupSettingsRow["whoMayPropose"],
    oneOffEventsAllowed: Boolean(row.one_off_events_allowed),
    recurringEventsEnabled: Boolean(row.recurring_events_enabled),
    maybeResponsesEnabled: Boolean(row.maybe_responses_enabled),
    minimumAttendees: Number(row.minimum_attendees),
    proposalDeadlineHours:
      row.proposal_deadline_hours === null
        ? null
        : Number(row.proposal_deadline_hours),
    consensusRule: row.consensus_rule as GroupSettingsRow["consensusRule"],
    adminVetoEnabled: Boolean(row.admin_veto_enabled),
    hostVetoEnabled: Boolean(row.host_veto_enabled),
    hostingEnabled: row.hosting_enabled !== false,
    avoidConsecutiveHosts: Boolean(row.avoid_consecutive_hosts),
    timezone:
      typeof row.timezone === "string" && row.timezone.length > 0
        ? row.timezone
        : "Pacific/Auckland",
    reconnectRemindersEnabled: Boolean(row.reconnect_reminders_enabled),
    reconnectAfterDays:
      row.reconnect_after_days === null ? null : Number(row.reconnect_after_days),
  };
}

export async function listGroupsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<GroupListItem[]> {
  const { data, error } = await supabase
    .from("group_memberships")
    .select(
      `
      role,
      groups:group_id (
        id,
        name
      )
    `,
    )
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  const items: GroupListItem[] = [];
  for (const row of data ?? []) {
    const raw = row.groups as { id: string; name: string } | { id: string; name: string }[] | null;
    const group = Array.isArray(raw) ? raw[0] : raw;
    if (!group) {
      continue;
    }
    items.push({
      id: group.id,
      name: group.name,
      role: row.role as MembershipRole,
    });
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGroupDetail(
  supabase: SupabaseClient,
  groupId: string,
  userId: string,
): Promise<GroupDetail | null> {
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("id, name, owner_id")
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    throw new Error(groupError.message);
  }
  if (!group) {
    return null;
  }

  const { data: viewerMembership, error: viewerError } = await supabase
    .from("group_memberships")
    .select("role, status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (viewerError) {
    throw new Error(viewerError.message);
  }
  if (!viewerMembership || viewerMembership.status !== "active") {
    return null;
  }

  const [membersResult, settingsResult] = await Promise.all([
    supabase
      .from("group_memberships")
      .select(
        `
      user_id,
      role,
      joined_at,
      consensus_required,
      hosting_standing,
      profiles:user_id (
        display_name
      )
    `,
      )
      .eq("group_id", groupId)
      .eq("status", "active")
      .order("joined_at", { ascending: true }),
    supabase.from("group_settings").select("*").eq("group_id", groupId).maybeSingle(),
  ]);

  const { data: members, error: membersError } = membersResult;
  if (membersError) {
    throw new Error(membersError.message);
  }

  const { data: settings, error: settingsError } = settingsResult;
  if (settingsError) {
    throw new Error(settingsError.message);
  }
  if (!settings) {
    throw new Error("Group settings are missing.");
  }

  return {
    id: group.id,
    name: group.name,
    ownerId: group.owner_id,
    viewerRole: viewerMembership.role as MembershipRole,
    members: (members ?? []).map((member) => {
      const rawProfile = member.profiles as
        | { display_name: string }
        | { display_name: string }[]
        | null;
      const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
      return {
        userId: member.user_id as string,
        displayName: profile?.display_name ?? "Member",
        role: member.role as MembershipRole,
        joinedAt: member.joined_at as string,
        consensusRequired: Boolean(member.consensus_required),
        hostingStanding: (member.hosting_standing ??
          "default") as GroupDetail["members"][number]["hostingStanding"],
      };
    }),
    settings: mapSettings(settings),
  };
}
