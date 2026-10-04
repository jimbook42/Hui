import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  attendanceStateFromChoice,
  classifyHomeEvent,
  compareMostRecent,
  compareSoonest,
  type HomeAttention,
  type HomeBucket,
} from "@/domain/events/home";
import type { EventStatus } from "@/domain/events/types";
import type { MembershipRole } from "@/domain/groups/permissions";
import { canProposeEvents, groupAllowsEventKind } from "@/domain/events/permissions";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import {
  countAttendance,
  type AttendanceCounts,
  type AttendanceVisualState,
} from "@/domain/scheduling/attendance-visual";
import { dbResponseToAvailability } from "@/domain/scheduling/mapping";
import type {
  AvailabilityChoice,
  CandidateStatus,
  DbResponseValue,
} from "@/domain/scheduling/types";
import { ACTIVE_CANDIDATE_STATUSES } from "@/domain/scheduling/types";
import { getCandidateAttendanceRoster } from "@/lib/scheduling/queries";

const DEFAULT_TIME_ZONE = "Pacific/Auckland";
const OPEN_STATUSES: EventStatus[] = ["proposing", "voting", "awaiting_agreement", "reopened", "confirmed"];
const PAST_STATUSES: EventStatus[] = ["completed", "cancelled"];
/** Roster RPCs are per candidate; cap how many we fan out on list surfaces. */
const ROSTER_FANOUT = 8;

export type HomeEvent = {
  id: string;
  title: string;
  status: EventStatus;
  groupId: string;
  groupName: string;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  candidateId: string | null;
  viewerResponse: AvailabilityChoice | null;
  viewerState: AttendanceVisualState;
  bucket: HomeBucket;
  attention: HomeAttention | null;
  maybeResponsesEnabled: boolean;
  roster: AttendanceRoster | null;
  counts: AttendanceCounts | null;
  hostName: string | null;
  /** Active contribution categories nobody has claimed yet (confirmed gatherings only). */
  contributionsOpen: number | null;
};

export type ProposableGroup = { id: string; name: string };

export type HomeData = {
  events: HomeEvent[];
  groups: { id: string; name: string; role: MembershipRole }[];
  proposableGroups: ProposableGroup[];
};

type EventRow = {
  id: string;
  title: string;
  status: EventStatus;
  group_id: string;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  groups: { name: string } | { name: string }[] | null;
};

type CandidateRow = {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  status: CandidateStatus;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** The time currently on the table: the selected candidate, else the earliest proposed one. */
function pickCandidate(candidates: CandidateRow[]): CandidateRow | null {
  const selected = candidates.find((candidate) => candidate.status === "selected");
  if (selected) {
    return selected;
  }
  return (
    [...candidates]
      .filter((candidate) => candidate.status === "proposed")
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] ?? null
  );
}

export async function loadHomeData(
  supabase: SupabaseClient,
  userId: string,
  options: {
    includePast?: boolean;
    /** Only events in this group. */
    groupId?: string;
    /** Skip events entirely (group pickers only need memberships + settings). */
    groupsOnly?: boolean;
    /** Skip the per-gathering attendance roster fan-out (list surfaces that only need previews). */
    skipRosters?: boolean;
  } = {},
): Promise<HomeData> {
  const statuses = options.includePast ? [...OPEN_STATUSES, ...PAST_STATUSES] : OPEN_STATUSES;

  let eventsQuery = supabase
    .from("events")
    .select(
      "id, title, status, group_id, location, starts_at, ends_at, timezone, groups:group_id ( name )",
    )
    .in("status", statuses)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .limit(80);
  if (options.groupId) {
    eventsQuery = eventsQuery.eq("group_id", options.groupId);
  }

  const [eventsResult, membershipsResult] = await Promise.all([
    options.groupsOnly
      ? Promise.resolve({ data: [] as unknown[], error: null })
      : eventsQuery,
    supabase
      .from("group_memberships")
      .select("role, groups:group_id ( id, name )")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  if (eventsResult.error) {
    throw new Error(eventsResult.error.message);
  }
  if (membershipsResult.error) {
    throw new Error(membershipsResult.error.message);
  }

  const groups: HomeData["groups"] = [];
  for (const row of membershipsResult.data ?? []) {
    const group = one(row.groups as { id: string; name: string } | { id: string; name: string }[] | null);
    if (group) {
      groups.push({ id: group.id, name: group.name, role: row.role as MembershipRole });
    }
  }
  groups.sort((a, b) => a.name.localeCompare(b.name));

  const eventRows = (eventsResult.data ?? []) as unknown as EventRow[];
  const eventIds = eventRows.map((row) => row.id);
  const groupIds = [...new Set([...eventRows.map((row) => row.group_id), ...groups.map((g) => g.id)])];

  const [candidatesResult, settingsResult, hostResult, categoriesResult, contributionsResult] =
    await Promise.all([
      eventIds.length > 0
        ? supabase
            .from("event_candidates")
            .select("id, event_id, starts_at, ends_at, status")
            .in("event_id", eventIds)
            .in("status", [...ACTIVE_CANDIDATE_STATUSES])
        : Promise.resolve({ data: [], error: null }),
      groupIds.length > 0
        ? supabase
            .from("group_settings")
            .select(
              "group_id, timezone, maybe_responses_enabled, who_may_propose, one_off_events_allowed, recurring_events_enabled",
            )
            .in("group_id", groupIds)
        : Promise.resolve({ data: [], error: null }),
      eventIds.length > 0
        ? supabase
            .from("host_assignments")
            .select("event_id, user_id, status, display_name")
            .in("event_id", eventIds)
            .in("status", ["proposed", "accepted"])
            .not("user_id", "is", null)
        : Promise.resolve({ data: [], error: null }),
      groupIds.length > 0
        ? supabase
            .from("contribution_categories")
            .select("id, group_id")
            .in("group_id", groupIds)
            .is("archived_at", null)
        : Promise.resolve({ data: [], error: null }),
      eventIds.length > 0
        ? supabase
            .from("event_contributions")
            .select("event_id, category_id, status")
            .in("event_id", eventIds)
            .eq("status", "accepted")
        : Promise.resolve({ data: [], error: null }),
    ]);

  for (const result of [candidatesResult, settingsResult, hostResult, categoriesResult, contributionsResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const candidatesByEvent = new Map<string, CandidateRow[]>();
  for (const row of (candidatesResult.data ?? []) as CandidateRow[]) {
    const list = candidatesByEvent.get(row.event_id) ?? [];
    list.push(row);
    candidatesByEvent.set(row.event_id, list);
  }

  const settingsByGroup = new Map<
    string,
    { timezone: string; maybe: boolean; raw: Record<string, unknown> }
  >();
  for (const row of (settingsResult.data ?? []) as Array<Record<string, unknown>>) {
    settingsByGroup.set(row.group_id as string, {
      timezone:
        typeof row.timezone === "string" && row.timezone.length > 0 ? row.timezone : DEFAULT_TIME_ZONE,
      maybe: row.maybe_responses_enabled !== false,
      raw: row,
    });
  }

  const pickedByEvent = new Map<string, CandidateRow | null>();
  const candidateIds: string[] = [];
  for (const row of eventRows) {
    const picked = pickCandidate(candidatesByEvent.get(row.id) ?? []);
    pickedByEvent.set(row.id, picked);
    if (picked) {
      candidateIds.push(picked.id);
    }
  }

  const responsesResult =
    candidateIds.length > 0
      ? await supabase
          .from("event_responses")
          .select("candidate_id, response")
          .eq("user_id", userId)
          .in("candidate_id", candidateIds)
      : { data: [], error: null };
  if (responsesResult.error) {
    throw new Error(responsesResult.error.message);
  }
  const responseByCandidate = new Map<string, AvailabilityChoice>();
  for (const row of (responsesResult.data ?? []) as Array<{ candidate_id: string; response: DbResponseValue }>) {
    responseByCandidate.set(row.candidate_id, dbResponseToAvailability(row.response));
  }

  const pendingHostEvents = new Set<string>();
  const hostNameByEvent = new Map<string, string>();
  for (const row of (hostResult.data ?? []) as Array<{
    event_id: string;
    user_id: string;
    status: string;
    display_name: string | null;
  }>) {
    if (row.status === "proposed" && row.user_id === userId) {
      pendingHostEvents.add(row.event_id);
    }
    if (row.status === "accepted" && row.display_name) {
      hostNameByEvent.set(row.event_id, row.display_name);
    }
  }

  const categoriesByGroup = new Map<string, Set<string>>();
  for (const row of (categoriesResult.data ?? []) as Array<{ id: string; group_id: string }>) {
    const set = categoriesByGroup.get(row.group_id) ?? new Set<string>();
    set.add(row.id);
    categoriesByGroup.set(row.group_id, set);
  }
  const claimedByEvent = new Map<string, Set<string>>();
  for (const row of (contributionsResult.data ?? []) as Array<{ event_id: string; category_id: string | null }>) {
    if (!row.category_id) continue;
    const set = claimedByEvent.get(row.event_id) ?? new Set<string>();
    set.add(row.category_id);
    claimedByEvent.set(row.event_id, set);
  }

  const now = new Date();
  const events: HomeEvent[] = eventRows.map((row) => {
    const picked = pickedByEvent.get(row.id) ?? null;
    const groupSettings = settingsByGroup.get(row.group_id);
    const viewerResponse = picked ? (responseByCandidate.get(picked.id) ?? null) : null;
    const startsAt = row.starts_at ?? picked?.starts_at ?? null;
    const endsAt = row.ends_at ?? picked?.ends_at ?? null;
    const maybeEnabled = groupSettings?.maybe ?? true;
    const { bucket, attention } = classifyHomeEvent(
      {
        status: row.status,
        startsAt,
        endsAt,
        viewerResponse,
        hasCandidate: picked !== null,
        hasPendingHostProposal: pendingHostEvents.has(row.id),
      },
      now,
    );

    let contributionsOpen: number | null = null;
    if (row.status === "confirmed" && bucket !== "past") {
      const categories = categoriesByGroup.get(row.group_id);
      if (categories && categories.size > 0) {
        const claimed = claimedByEvent.get(row.id) ?? new Set<string>();
        contributionsOpen = [...categories].filter((id) => !claimed.has(id)).length;
      }
    }

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      groupId: row.group_id,
      groupName: one(row.groups)?.name ?? "Group",
      location: row.location?.trim() ? row.location.trim() : null,
      startsAt,
      endsAt,
      timeZone: row.timezone && row.timezone.length > 0 ? row.timezone : (groupSettings?.timezone ?? DEFAULT_TIME_ZONE),
      candidateId: picked?.id ?? null,
      viewerResponse,
      viewerState: attendanceStateFromChoice(viewerResponse, maybeEnabled),
      bucket,
      attention,
      maybeResponsesEnabled: maybeEnabled,
      roster: null,
      counts: null,
      hostName: hostNameByEvent.get(row.id) ?? null,
      contributionsOpen,
    };
  });

  // Rosters (people around the table) for the gatherings people actually look at first.
  const rank: Record<HomeBucket, number> = { attention: 0, upcoming: 1, planning: 2, past: 3 };
  const rosterTargets = (options.skipRosters ? [] : events)
    .filter((event) => event.candidateId && event.bucket !== "past")
    .sort((a, b) => rank[a.bucket] - rank[b.bucket] || compareSoonest(a, b))
    .slice(0, ROSTER_FANOUT);

  const rosters = await Promise.all(
    rosterTargets.map(async (event) => ({
      id: event.id,
      roster: await getCandidateAttendanceRoster(supabase, event.candidateId as string),
    })),
  );
  for (const { id, roster } of rosters) {
    const target = events.find((event) => event.id === id);
    if (target && roster) {
      target.roster = roster;
      target.counts = countAttendance(roster.members, roster.maybeResponsesEnabled);
    }
  }

  const proposableGroups: ProposableGroup[] = [];
  for (const group of groups) {
    const raw = settingsByGroup.get(group.id)?.raw;
    if (!raw) continue;
    const settings = {
      whoMayPropose: raw.who_may_propose as "admins_only" | "any_member",
      oneOffEventsAllowed: Boolean(raw.one_off_events_allowed),
      recurringEventsEnabled: Boolean(raw.recurring_events_enabled),
    };
    // canProposeEvents / groupAllowsEventKind only read these fields.
    const asSettings = settings as unknown as Parameters<typeof canProposeEvents>[1];
    if (
      canProposeEvents(group.role, asSettings) &&
      (groupAllowsEventKind("one_off", asSettings) || groupAllowsEventKind("recurring", asSettings))
    ) {
      proposableGroups.push({ id: group.id, name: group.name });
    }
  }

  return { events, groups, proposableGroups };
}

export type HomeSections = {
  attention: HomeEvent[];
  upcoming: HomeEvent[];
  planning: HomeEvent[];
  past: HomeEvent[];
};

export function splitHomeEvents(events: HomeEvent[]): HomeSections {
  const sections: HomeSections = { attention: [], upcoming: [], planning: [], past: [] };
  for (const event of events) {
    sections[event.bucket].push(event);
  }
  sections.attention.sort(compareSoonest);
  sections.upcoming.sort(compareSoonest);
  sections.planning.sort(compareSoonest);
  sections.past.sort(compareMostRecent);
  return sections;
}

/** Where "Create Hui" should go: straight into the flow when there is only one place it could happen. */
export function createHuiHref(proposable: ProposableGroup[]): string | null {
  if (proposable.length === 0) {
    return null;
  }
  if (proposable.length === 1) {
    return `/groups/${proposable[0].id}/events/new`;
  }
  return "/events/new";
}