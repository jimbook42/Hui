"use server";

import { redirect } from "next/navigation";

import { parseInviteJoinPayload } from "@/domain/invites/resolve";
import { createClient } from "@/lib/supabase/server";

export type JoinActionState = {
  error?: string;
};

export async function joinGroupViaInviteAction(
  _prev: JoinActionState,
  formData: FormData,
): Promise<JoinActionState> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    return { error: "This invite link is no longer valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(`/join/${token}`);
    redirect(`/sign-in?next=${next}`);
  }

  const { data, error } = await supabase.rpc("join_group_via_invite", {
    p_token: token,
  });

  if (error) {
    return { error: error.message };
  }

  const result = parseInviteJoinPayload(data);
  if (result.status === "invalid") {
    return { error: "This invite link is no longer valid." };
  }

  redirect(`/groups/${result.groupId}`);
}
