import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  EventDecisionBundle,
  EventDecisionOptionRow,
  EventDecisionResponseRow,
  EventDecisionRow,
  EventDecisionStatus,
} from "@/lib/decisions/types";

type DbDecision = {
  id: string;
  event_id: string;
  group_id: string;
  question: string;
  status: EventDecisionStatus;
  created_by: string;
  selected_option_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

type DbOption = {
  id: string;
  decision_id: string;
  label: string;
  position: number;
};

type DbResponse = {
  id: string;
  decision_id: string;
  option_id: string;
  user_id: string;
};

function mapDecision(row: DbDecision): EventDecisionRow {
  return {
    id: row.id,
    eventId: row.event_id,
    groupId: row.group_id,
    question: row.question,
    status: row.status,
    createdBy: row.created_by,
    selectedOptionId: row.selected_option_id,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  };
}

function mapOption(row: DbOption): EventDecisionOptionRow {
  return {
    id: row.id,
    decisionId: row.decision_id,
    label: row.label,
    position: row.position,
  };
}

function mapResponse(row: DbResponse): EventDecisionResponseRow {
  return {
    id: row.id,
    decisionId: row.decision_id,
    optionId: row.option_id,
    userId: row.user_id,
  };
}

export async function listEventDecisions(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventDecisionBundle[]> {
  const { data: decisions, error } = await supabase
    .from("event_decisions")
    .select(
      "id, event_id, group_id, question, status, created_by, selected_option_id, decided_by, decided_at, cancelled_at, created_at",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const decisionRows = (decisions ?? []) as DbDecision[];
  if (decisionRows.length === 0) {
    return [];
  }

  const decisionIds = decisionRows.map((row) => row.id);
  const [optionsResult, responsesResult] = await Promise.all([
    supabase
      .from("event_decision_options")
      .select("id, decision_id, label, position")
      .in("decision_id", decisionIds)
      .order("position", { ascending: true }),
    supabase
      .from("event_decision_responses")
      .select("id, decision_id, option_id, user_id")
      .in("decision_id", decisionIds),
  ]);

  if (optionsResult.error) {
    throw new Error(optionsResult.error.message);
  }
  if (responsesResult.error) {
    throw new Error(responsesResult.error.message);
  }

  const optionsByDecision = new Map<string, EventDecisionOptionRow[]>();
  for (const row of (optionsResult.data ?? []) as DbOption[]) {
    const list = optionsByDecision.get(row.decision_id) ?? [];
    list.push(mapOption(row));
    optionsByDecision.set(row.decision_id, list);
  }

  const responsesByDecision = new Map<string, EventDecisionResponseRow[]>();
  for (const row of (responsesResult.data ?? []) as DbResponse[]) {
    const list = responsesByDecision.get(row.decision_id) ?? [];
    list.push(mapResponse(row));
    responsesByDecision.set(row.decision_id, list);
  }

  return decisionRows.map((row) => ({
    decision: mapDecision(row),
    options: optionsByDecision.get(row.id) ?? [],
    responses: responsesByDecision.get(row.id) ?? [],
  }));
}

export async function getEventDecisionBundle(
  supabase: SupabaseClient,
  decisionId: string,
): Promise<EventDecisionBundle | null> {
  const { data: decision, error } = await supabase
    .from("event_decisions")
    .select(
      "id, event_id, group_id, question, status, created_by, selected_option_id, decided_by, decided_at, cancelled_at, created_at",
    )
    .eq("id", decisionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!decision) {
    return null;
  }

  const row = decision as DbDecision;
  const [optionsResult, responsesResult] = await Promise.all([
    supabase
      .from("event_decision_options")
      .select("id, decision_id, label, position")
      .eq("decision_id", decisionId)
      .order("position", { ascending: true }),
    supabase
      .from("event_decision_responses")
      .select("id, decision_id, option_id, user_id")
      .eq("decision_id", decisionId),
  ]);

  if (optionsResult.error) {
    throw new Error(optionsResult.error.message);
  }
  if (responsesResult.error) {
    throw new Error(responsesResult.error.message);
  }

  return {
    decision: mapDecision(row),
    options: ((optionsResult.data ?? []) as DbOption[]).map(mapOption),
    responses: ((responsesResult.data ?? []) as DbResponse[]).map(mapResponse),
  };
}

/** Open decisions for many events (home attention). */
export async function listOpenDecisionsForEvents(
  supabase: SupabaseClient,
  eventIds: string[],
  viewerUserId: string,
): Promise<Map<string, { needsResponse: boolean }>> {
  const result = new Map<string, { needsResponse: boolean }>();
  if (eventIds.length === 0) {
    return result;
  }

  const { data: decisions, error } = await supabase
    .from("event_decisions")
    .select("id, event_id")
    .in("event_id", eventIds)
    .eq("status", "open");

  if (error) {
    throw new Error(error.message);
  }

  const openRows = (decisions ?? []) as Array<{ id: string; event_id: string }>;
  if (openRows.length === 0) {
    return result;
  }

  const decisionIds = openRows.map((row) => row.id);
  const { data: responses, error: responseError } = await supabase
    .from("event_decision_responses")
    .select("decision_id")
    .in("decision_id", decisionIds)
    .eq("user_id", viewerUserId);

  if (responseError) {
    throw new Error(responseError.message);
  }

  const answered = new Set(
    ((responses ?? []) as Array<{ decision_id: string }>).map((row) => row.decision_id),
  );

  for (const row of openRows) {
    const needsResponse = !answered.has(row.id);
    const existing = result.get(row.event_id);
    if (!existing) {
      result.set(row.event_id, { needsResponse });
    } else if (needsResponse) {
      result.set(row.event_id, { needsResponse: true });
    }
  }

  return result;
}
