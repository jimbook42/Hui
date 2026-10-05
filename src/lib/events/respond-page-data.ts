import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canCoordinateContributions } from "@/domain/contributions/permissions";
import {
  canSuggestAlternativeTimeInFlow,
  canUseParticipantRespondFlow,
  pickParticipantTimeCandidate,
} from "@/domain/events/participant-flow";
import { participantPlaceView } from "@/domain/events/participant-place";
import {
  inferStandingAvailabilityHint,
  type StandingAvailabilityHint,
} from "@/domain/scheduling/standing-availability";
import { canRespondToCandidates } from "@/domain/scheduling/permissions";
import { listMyStandingAvailabilityForGroup } from "@/lib/availability/queries";
import { listContributionCategories, listEventContributions } from "@/lib/contributions/queries";
import { getEventDetail } from "@/lib/events/queries";
import { getGroupSettingsByGroupId } from "@/lib/groups/settings-query";
import { getAcceptedHostDisplayName } from "@/lib/hosts/queries";
import { getEventSchedulingContext } from "@/lib/scheduling/queries";
import type { ContributionCategoryRow, EventContributionRow } from "@/lib/contributions/types";
import type { EventCandidateRow } from "@/lib/scheduling/types";
import type { EventDetail } from "@/lib/events/types";

export type RespondPrimaryData = {
  detail: EventDetail;
  candidate: EventCandidateRow;
  displayTimeZone: string;
  canRespond: boolean;
  maybeResponsesEnabled: boolean;
  canSuggestTime: boolean;
  placeView: ReturnType<typeof participantPlaceView>;
  canCoordinateContributions: boolean;
  hostingEnabled: boolean;
  standingAvailabilityHint: StandingAvailabilityHint | null;
};

export type RespondSecondaryData = {
  categories: ContributionCategoryRow[];
  contributions: EventContributionRow[];
  acceptedHostUserId: string | null;
};

export async function loadRespondPrimary(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<RespondPrimaryData | "unavailable" | null> {
  const detail = await getEventDetail(supabase, eventId, userId);
  if (!detail) {
    return null;
  }

  const [scheduling, settings, acceptedHostDisplayName] = await Promise.all([
    getEventSchedulingContext(supabase, detail.id, detail.groupId, userId),
    getGroupSettingsByGroupId(supabase, detail.groupId),
    getAcceptedHostDisplayName(supabase, detail.id),
  ]);

  if (!settings) {
    return null;
  }

  const primary = pickParticipantTimeCandidate(scheduling.candidates);
  const candidate =
    primary === null
      ? null
      : (scheduling.candidates.find((row) => row.id === primary.id) ?? null);

  const flowAvailable = canUseParticipantRespondFlow({
    eventStatus: detail.status,
    hasCandidate: candidate !== null,
  });

  if (!flowAvailable || !candidate) {
    return "unavailable";
  }

  const displayTimeZone =
    detail.timezone ?? settings.timezone ?? "Pacific/Auckland";

  const placeView = participantPlaceView({
    eventStatus: detail.status,
    eventLocation: detail.location,
    acceptedHostDisplayName,
    hostingEnabled: settings.hostingEnabled,
  });

  const standingWindows = await listMyStandingAvailabilityForGroup(
    supabase,
    detail.groupId,
    userId,
  );
  const standingAvailabilityHint =
    candidate.viewerResponse === null
      ? inferStandingAvailabilityHint(
          standingWindows,
          candidate.startsAt,
          candidate.endsAt,
          displayTimeZone,
        )
      : null;

  return {
    detail,
    candidate,
    displayTimeZone,
    canRespond: canRespondToCandidates(detail.status),
    maybeResponsesEnabled: scheduling.maybeResponsesEnabled,
    canSuggestTime: canSuggestAlternativeTimeInFlow(
      detail.viewerRole,
      settings,
      detail.status,
    ),
    placeView,
    canCoordinateContributions: canCoordinateContributions(detail.status),
    hostingEnabled: settings.hostingEnabled,
    standingAvailabilityHint,
  };
}

export async function loadRespondSecondary(
  supabase: SupabaseClient,
  eventId: string,
  groupId: string,
): Promise<RespondSecondaryData> {
  const [contributions, categories, hostRow] = await Promise.all([
    listEventContributions(supabase, eventId),
    listContributionCategories(supabase, groupId),
    supabase
      .from("host_assignments")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    contributions,
    categories,
    acceptedHostUserId: hostRow.data?.user_id ?? null,
  };
}
