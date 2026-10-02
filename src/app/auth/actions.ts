"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { resolveAuthRedirectOrigin } from "@/lib/auth/app-origin";
import {
  buildOAuthCallbackUrl,
  signInWithOAuthProvider,
} from "@/lib/auth/oauth";
import {
  isAuthOAuthProviderId,
} from "@/lib/auth/providers";
import { sanitizeNextPath } from "@/lib/auth/routes";
import { ensureUserProfile } from "@/lib/profiles/ensure-profile";
import { initialDisplayNameFromAuthMetadata } from "@/lib/profiles/initial-display-name";
import { updateOwnDisplayName } from "@/lib/profiles/update-display-name";
import { isAccountDeletionConfirmed } from "@/lib/auth/account-deletion";
import { normalizeDisplayName } from "@/lib/profiles/validation";
import { createSecretSupabaseClient } from "@/lib/supabase/admin";
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

  const ensured = await ensureUserProfile(
    supabase,
    data.user.id,
    initialDisplayNameFromAuthMetadata(data.user.user_metadata, data.user.email),
  );
  if (!ensured.ok) {
    return { error: ensured.error };
  }

  redirect(next);
}

export async function oauthSignInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const providerRaw = String(formData.get("provider") ?? "").trim();
  if (!isAuthOAuthProviderId(providerRaw)) {
    return { error: "That sign-in option is not available." };
  }

  const next = sanitizeNextPath(String(formData.get("next") ?? ""));

  let oauthUrl: string;
  try {
    const origin = await resolveAuthRedirectOrigin();
    const redirectTo = buildOAuthCallbackUrl(origin, next);
    const supabase = await createClient();
    const { data, error } = await signInWithOAuthProvider(
      supabase,
      providerRaw,
      redirectTo,
    );

    if (error || !data.url) {
      return {
        error:
          "Could not start social sign-in. Try again or use email and password.",
      };
    }

    oauthUrl = data.url;
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        "Could not start social sign-in. Try again or use email and password.",
    };
  }

  redirect(oauthUrl);
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

export async function deleteAccountAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const confirmation = String(formData.get("confirmation") ?? "");
  if (!isAccountDeletionConfirmed(confirmation)) {
    return { error: 'Type DELETE (all caps) to confirm account deletion.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { error: dataError } = await supabase.rpc("delete_my_account_data");
  if (dataError) {
    return { error: dataError.message };
  }

  try {
    const admin = createSecretSupabaseClient();
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(
      user.id,
    );
    if (authDeleteError) {
      return {
        error:
          "Your Hui data was removed but sign-in could not be fully deleted. Contact support or try again.",
      };
    }
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        "Account deletion is not configured on this server. Try again later.",
    };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in?deleted=1");
}
