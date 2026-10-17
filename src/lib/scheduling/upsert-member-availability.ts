import type { SupabaseClient } from "@supabase/supabase-js";

export async function upsertMemberAvailability(
  supabase: SupabaseClient,
  input: {
    candidateId: string;
    userId: string;
    dbResponse: string;
    hasNoteField: boolean;
    privateNote: string | null;
  },
): Promise<{ error: string | null }> {
  const row: Record<string, unknown> = {
    candidate_id: input.candidateId,
    user_id: input.userId,
    response: input.dbResponse,
    visibility: "group",
  };
  if (input.hasNoteField) {
    if (input.dbResponse === "no") {
      row.note = input.privateNote;
      row.note_shared_with_group = input.privateNote !== null;
    } else {
      row.note = null;
      row.note_shared_with_group = false;
    }
  }
  const { error } = await supabase.from("event_responses").upsert(row, {
    onConflict: "candidate_id,user_id",
  });
  return { error: error?.message ?? null };
}
