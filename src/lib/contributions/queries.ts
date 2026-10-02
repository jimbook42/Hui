import type { SupabaseClient } from "@supabase/supabase-js";

import { buildContributionHistory } from "@/domain/contributions/display";

import type {
  ContributionCategoryRow,
  EventContributionRow,
  GroupContributionHistory,
} from "./types";

function mapCategory(row: Record<string, unknown>): ContributionCategoryRow {
  return {
    id: row.id as string,
    groupId: row.group_id as string,
    name: row.name as string,
    archivedAt: row.archived_at === null ? null : (row.archived_at as string),
    followsHost: Boolean(row.follows_host),
    defaultAssigneeUserId:
      row.default_assignee_user_id === null ? null : (row.default_assignee_user_id as string),
  };
}

function mapContribution(row: Record<string, unknown>): EventContributionRow {
  const rawCategory = row.contribution_categories as
    | { name: string }
    | { name: string }[]
    | null;
  const category = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;

  return {
    id: row.id as string,
    eventId: row.event_id as string,
    groupId: row.group_id as string,
    categoryId: row.category_id === null ? null : (row.category_id as string),
    categoryName: category?.name ?? null,
    userId: row.user_id === null ? null : (row.user_id as string),
    label: row.label as string,
    status: row.status as string,
    displayName: row.display_name === null ? null : (row.display_name as string),
  };
}

export async function listContributionCategories(
  supabase: SupabaseClient,
  groupId: string,
): Promise<ContributionCategoryRow[]> {
  const { data, error } = await supabase
    .from("contribution_categories")
    .select("id, group_id, name, archived_at, follows_host, default_assignee_user_id")
    .eq("group_id", groupId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapCategory(row as Record<string, unknown>));
}

export async function listEventContributions(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventContributionRow[]> {
  const { data, error } = await supabase
    .from("event_contributions")
    .select(
      `
      id,
      event_id,
      group_id,
      category_id,
      user_id,
      label,
      status,
      display_name,
      contribution_categories (
        name
      )
    `,
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapContribution(row as Record<string, unknown>));
}

const HISTORY_EVENT_STATUSES = ["confirmed", "completed"] as const;

export async function getGroupContributionHistory(
  supabase: SupabaseClient,
  groupId: string,
  viewerUserId: string,
): Promise<GroupContributionHistory> {
  const { data, error } = await supabase
    .from("event_contributions")
    .select(
      `
      user_id,
      display_name,
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

  const entries = buildContributionHistory(historyRows);
  const viewerCount = entries.find((e) => e.userId === viewerUserId)?.count ?? null;

  return { entries, viewerCount };
}
