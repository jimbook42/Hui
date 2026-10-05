import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  canUseParticipantRespondFlow,
  pickParticipantTimeCandidate,
} from "@/domain/events/participant-flow";
import type { EventStatus } from "@/domain/events/types";
import { participantRespondPath } from "@/lib/events/paths";
import { getGroupSettingsByGroupId } from "@/lib/groups/settings-query";
import { getEventSchedulingContext } from "@/lib/scheduling/queries";

const COORDINATION_STATUSES: EventStatus[] = [
  "proposing",
  "voting",
  "awaiting_agreement",
  "reopened",
];

/** After joining a group, send new participants straight into coordination when one is open. */
export async function resolvePostInviteJoinPath(
  supabase: SupabaseClient,
  groupId: string,
  userId: string,
): Promise<string> {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, status")
    .eq("group_id", groupId)
    .in("status", COORDINATION_STATUSES)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error || !events?.length) {
    return `/groups/${groupId}`;
  }

  for (const row of events) {
    const eventId = row.id as string;
    const status = row.status as EventStatus;
    const scheduling = await getEventSchedulingContext(
      supabase,
      eventId,
      groupId,
      userId,
    );
    const primary = pickParticipantTimeCandidate(scheduling.candidates);
    const hasCandidate = primary !== null;
    if (
      canUseParticipantRespondFlow({ eventStatus: status, hasCandidate }) &&
      primary?.viewerResponse === null
    ) {
      return participantRespondPath(eventId);
    }
  }

  const newest = events[0]?.id as string | undefined;
  if (newest) {
    return participantRespondPath(newest);
  }

  return `/groups/${groupId}`;
}

export async function loadInvitePreviewTimeZone(
  supabase: SupabaseClient,
  groupId: string,
): Promise<string> {
  const settings = await getGroupSettingsByGroupId(supabase, groupId);
  return settings?.timezone ?? "Pacific/Auckland";
}
