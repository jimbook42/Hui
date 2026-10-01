"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/routes";
import { ensureUserProfile } from "@/lib/profiles/ensure-profile";
import { updateOwnDisplayName } from "@/lib/profiles/update-display-name";
import { normalizeDisplayName } from "@/lib/profiles/validation";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  message?: string;
};

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayNameRaw = String(formData.get("display_name") ?? "");
  const displayName = normalizeDisplayName(displayNameRaw);

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (!displayName) {
    return { error: "Display name must be between 1 and 80 characters." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    await ensureUserProfile(supabase, data.user!.id, displayName);
    redirect("/dashboard");
  }

  return {
    message:
      "Check your email for a verification link. You can sign in after verifying your address.",
  };
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const displayName =
    (data.user.user_metadata?.display_name as string | undefined) ??
    email.split("@")[0];
  const ensured = await ensureUserProfile(supabase, data.user.id, displayName);
  if (!ensured.ok) {
    return { error: ensured.error };
  }

  redirect(next);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}

export async function updateProfileAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const displayName = String(formData.get("display_name") ?? "");
  const result = await updateOwnDisplayName(supabase, user.id, displayName);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { message: "Profile updated." };
}
