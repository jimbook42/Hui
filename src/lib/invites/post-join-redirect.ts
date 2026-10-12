import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  canUseParticipantRespondFlow,
  pickParticipantTimeCandidate,
} from "@/domain/events/participant-flow";
import type { EventStatus } from "@/domain/events/types";
import { prioritizeInviteFocusEvent } from "@/domain/invites/focus-event";
import { participantRespondPath } from "@/lib/events/paths";
import { getGroupSettingsByGroupId } from "@/lib/groups/settings-query";
import { getEventSchedulingContext } from "@/lib/scheduling/queries";

const COORDINATION_STATUSES: EventStatus[] = [
  "proposing",
  "voting",
  "awaiting_agreement",
  "reopened",
];

type CoordinationEventRow = { id: string; status: EventStatus };

async function respondPathIfOpen(
  supabase: SupabaseClient,
  groupId: string,
  userId: string,
  row: CoordinationEventRow,
): Promise<string | null> {
  const scheduling = await getEventSchedulingContext(supabase, row.id, groupId, userId);
  const primary = pickParticipantTimeCandidate(scheduling.candidates);
  const hasCandidate = primary !== null;
  if (
    canUseParticipantRespondFlow({ eventStatus: row.status, hasCandidate }) &&
    primary?.viewerResponse === null
  ) {
    return participantRespondPath(row.id);
  }
  return null;
}

/** After joining a group, send new participants straight into coordination when one is open. */
export async function resolvePostInviteJoinPath(
  supabase: SupabaseClient,
  groupId: string,
  userId: string,
  focusEventId?: string | null,
): Promise<string> {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, status")
    .eq("group_id", groupId)
    .in("status", COORDINATION_STATUSES)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !events?.length) {
    if (focusEventId) {
      const { data: focusOnly } = await supabase
        .from("events")
        .select("id, status")
        .eq("group_id", groupId)
        .eq("id", focusEventId)
        .maybeSingle();
      if (focusOnly && COORDINATION_STATUSES.includes(focusOnly.status as EventStatus)) {
        const direct = await respondPathIfOpen(
          supabase,
          groupId,
          userId,
          focusOnly as CoordinationEventRow,
        );
        if (direct) {
          return direct;
        }
        return participantRespondPath(focusEventId);
      }
    }
    return `/groups/${groupId}`;
  }

  const rows = prioritizeInviteFocusEvent(events as CoordinationEventRow[], focusEventId);

  if (focusEventId && !rows.some((row) => row.id === focusEventId)) {
    const { data: focusRow } = await supabase
      .from("events")
      .select("id, status")
      .eq("group_id", groupId)
      .eq("id", focusEventId)
      .maybeSingle();
    if (focusRow && COORDINATION_STATUSES.includes(focusRow.status as EventStatus)) {
      rows.unshift(focusRow as CoordinationEventRow);
    }
  }

  for (const row of rows) {
    const path = await respondPathIfOpen(supabase, groupId, userId, row);
    if (path) {
      return path;
    }
  }

  const newest = rows[0]?.id;
  if (newest) {
    return participantRespondPath(newest);
  }

  return `/groups/${groupId}`;
}

export async function loadInvitePreviewTimeZone(
  supabase: SupabaseClient,
  groupId: string,
): Promise<string> {
  try {
    const settings = await getGroupSettingsByGroupId(supabase, groupId);
    return settings?.timezone ?? "Pacific/Auckland";
  } catch {
    return "Pacific/Auckland";
  }
}
