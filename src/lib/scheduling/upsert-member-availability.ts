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
  const { error } = await supabase.from("event_responses").upsert(
    {
      candidate_id: input.candidateId,
      user_id: input.userId,
      response: input.dbResponse,
      visibility: "group",
      ...(input.hasNoteField ? { note: input.privateNote } : {}),
    },
    { onConflict: "candidate_id,user_id" },
  );
  return { error: error?.message ?? null };
}
