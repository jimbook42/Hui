"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canManageEventDecisions,
  canRespondToEventDecisions,
} from "@/domain/decisions/permissions";
import {
  parseDecisionOptionDrafts,
  validateDecisionDraft,
} from "@/domain/decisions/validation";
import { getEventDetail } from "@/lib/events/queries";
import { eventDetailPath, eventManagePath } from "@/lib/events/paths";
import { createClient } from "@/lib/supabase/server";

export type DecisionActionState = {
  error?: string;
  message?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }
  return { supabase, user };
}

function revalidateEvent(eventId: string) {
  revalidatePath(eventDetailPath(eventId));
  revalidatePath(eventManagePath(eventId));
  revalidatePath("/events");
  revalidatePath("/");
}

export async function createEventDecisionAction(
  _prev: DecisionActionState,
  formData: FormData,
): Promise<DecisionActionState> {
  const eventId = String(formData.get("event_id") ?? "");
  const question = String(formData.get("question") ?? "");
  const optionsRaw = String(formData.get("options") ?? "");
  const optionLabels = parseDecisionOptionDrafts(optionsRaw);
  const validationError = validateDecisionDraft(question, optionLabels);
  if (!eventId || validationError) {
    return { error: validationError ?? "Could not create this decision." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (
    !detail ||
    !canManageEventDecisions(detail.viewerRole, user.id, detail.createdBy, detail.status)
  ) {
    return { error: "You cannot add decisions for this hui." };
  }

  const { error } = await supabase.rpc("create_event_decision", {
    p_event_id: eventId,
    p_question: question.trim(),
    p_option_labels: optionLabels,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateEvent(eventId);
  return { message: "Decision opened for the group." };
}

export async function updateEventDecisionDraftAction(
  _prev: DecisionActionState,
  formData: FormData,
): Promise<DecisionActionState> {
  const decisionId = String(formData.get("decision_id") ?? "");
  const eventId = String(formData.get("event_id") ?? "");
  const question = String(formData.get("question") ?? "");
  const optionsRaw = String(formData.get("options") ?? "");
  const optionLabels = parseDecisionOptionDrafts(optionsRaw);
  const validationError = validateDecisionDraft(question, optionLabels);
  if (!decisionId || !eventId || validationError) {
    return { error: validationError ?? "Could not update this decision." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (
    !detail ||
    !canManageEventDecisions(detail.viewerRole, user.id, detail.createdBy, detail.status)
  ) {
    return { error: "You cannot edit decisions for this hui." };
  }

  const { error } = await supabase.rpc("update_event_decision_draft", {
    p_decision_id: decisionId,
    p_question: question.trim(),
    p_option_labels: optionLabels,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateEvent(eventId);
  return { message: "Decision updated." };
}

export async function respondEventDecisionAction(
  decisionId: string,
  optionId: string,
  eventId: string,
): Promise<DecisionActionState> {
  if (!decisionId || !optionId || !eventId) {
    return { error: "Pick an option to respond." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail || !canRespondToEventDecisions(detail.status)) {
    return { error: "This hui is not accepting decision responses." };
  }

  const { error } = await supabase.rpc("respond_event_decision", {
    p_decision_id: decisionId,
    p_option_id: optionId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateEvent(eventId);
  return { message: "Your choice was saved." };
}

export async function finalizeEventDecisionAction(
  decisionId: string,
  optionId: string,
  eventId: string,
): Promise<DecisionActionState> {
  if (!decisionId || !optionId || !eventId) {
    return { error: "Choose the result to record." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (
    !detail ||
    !canManageEventDecisions(detail.viewerRole, user.id, detail.createdBy, detail.status)
  ) {
    return { error: "Only someone managing this hui can record the group's decision." };
  }

  const { error } = await supabase.rpc("finalize_event_decision", {
    p_decision_id: decisionId,
    p_option_id: optionId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateEvent(eventId);
  return { message: "Decision recorded for the group." };
}

export async function cancelEventDecisionAction(
  decisionId: string,
  eventId: string,
): Promise<DecisionActionState> {
  if (!decisionId || !eventId) {
    return { error: "Decision not found." };
  }

  const { supabase, user } = await requireUser();
  const detail = await getEventDetail(supabase, eventId, user.id);
  if (
    !detail ||
    !canManageEventDecisions(detail.viewerRole, user.id, detail.createdBy, detail.status)
  ) {
    return { error: "You cannot cancel this decision." };
  }

  const { error } = await supabase.rpc("cancel_event_decision", {
    p_decision_id: decisionId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateEvent(eventId);
  return { message: "Decision cancelled." };
}
