"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canManageMembers } from "@/domain/groups/permissions";
import { getGroupDetail } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";

export type InviteActionState = {
  error?: string;
  message?: string;
  token?: string;
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

async function requireGroupInviteAdmin(groupId: string) {
  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail || !canManageMembers(detail.viewerRole)) {
    return { error: "You cannot manage invite links for this group." } as const;
  }
  return { supabase, user, groupId } as const;
}

export async function regenerateGroupInviteLinkAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  if (!groupId) {
    return { error: "Missing group." };
  }

  const auth = await requireGroupInviteAdmin(groupId);
  if ("error" in auth) {
    return { error: auth.error };
  }

  const { data, error } = await auth.supabase.rpc("regenerate_group_invite_link", {
    p_group_id: groupId,
  });

  if (error) {
    return { error: error.message };
  }

  const token = data as string;
  revalidatePath(`/groups/${groupId}`);
  return { message: "Invite link regenerated.", token };
}
