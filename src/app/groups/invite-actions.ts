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

/** Active members may fetch the share link when opening invite UI (avoids N RPCs on /groups). */
export async function fetchMemberGroupInviteLinkAction(
  groupId: string,
): Promise<{ token?: string; error?: string }> {
  if (!groupId) {
    return { error: "Missing group." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in to invite people." };
  }

  const { data, error } = await supabase.rpc("get_group_invite_link", {
    p_group_id: groupId,
  });

  if (error) {
    return { error: error.message };
  }

  if (typeof data !== "string" || data.length === 0) {
    return { error: "Could not load invite link." };
  }

  return { token: data };
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
