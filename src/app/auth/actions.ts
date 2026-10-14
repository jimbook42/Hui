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
import { deleteAuthUserWithVerification } from "@/lib/auth/delete-auth-user";
import { normalizeDisplayName } from "@/lib/profiles/validation";
import { createSecretSupabaseClient } from "@/lib/supabase/admin";
import { devTimed } from "@/lib/perf/dev-server-timing";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { createClient } from "@/lib/supabase/server";
import {
  preservedFieldsOnSignInValidationError,
  preservedFieldsOnSignUpValidationError,
  type PreservedAuthFields,
} from "@/domain/auth/form-field-preservation";
import { passwordsMeetRules } from "@/domain/auth/password-rules";
import {
  authTimeoutUserMessage,
  AuthActionTimeoutError,
  withAuthActionTimeout,
} from "@/lib/auth/action-timeout";

export type AuthActionState = {
  error?: string;
  message?: string;
  fields?: PreservedAuthFields;
};

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const emailConfirm = String(formData.get("email_confirm") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const displayNameRaw = String(formData.get("display_name") ?? "");
  const displayName = normalizeDisplayName(displayNameRaw);
  const next = sanitizeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return {
      error: "Email and password are required.",
      fields: preservedFieldsOnSignUpValidationError({
        email,
        password,
        displayName: displayNameRaw,
      }),
    };
  }
  if (!displayName) {
    return {
      error: "Display name must be between 1 and 80 characters.",
      fields: { display_name: displayNameRaw.trim(), email },
    };
  }
  if (email !== emailConfirm) {
    return {
      error: "Email addresses do not match.",
      fields: preservedFieldsOnSignUpValidationError({
        email,
        password,
        displayName,
      }),
    };
  }
  if (!passwordsMeetRules(password, passwordConfirm)) {
    return {
      error: "Password must be at least 8 characters and match the confirmation.",
      fields: preservedFieldsOnSignUpValidationError({
        email,
        password,
        displayName,
      }),
    };
  }

  const supabase = await createClient();
  let data;
  let error;
  try {
    const result = await withAuthActionTimeout(() =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      }),
    );
    data = result.data;
    error = result.error;
  } catch (caught) {
    if (caught instanceof AuthActionTimeoutError) {
      return { error: authTimeoutUserMessage() };
    }
    throw caught;
  }

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    await ensureUserProfile(supabase, data.user!.id, displayName);
    redirect(next);
  }

  const signInAttempt = await supabase.auth.signInWithPassword({ email, password });
  if (signInAttempt.data.session) {
    await ensureUserProfile(supabase, signInAttempt.data.user.id, displayName);
    redirect(next);
  }

  return { error: "Could not create your account. Try again or use a different email." };
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return {
      error: "Email and password are required.",
      fields: preservedFieldsOnSignInValidationError({ email, password }),
    };
  }

  const supabase = await createClient();
  try {
    const { data, error } = await withAuthActionTimeout(() =>
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
    );

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
  } catch (caught) {
    if (caught instanceof AuthActionTimeoutError) {
      return { error: authTimeoutUserMessage() };
    }
    unstable_rethrow(caught);
    return { error: "Sign-in failed. Try again." };
  }
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
  try {
    await supabase.auth.signOut({ scope: "global" });
    revalidatePath("/", "layout");
    redirect("/sign-in");
  } catch (error) {
    unstable_rethrow(error);
    throw error;
  }
}

export async function updateProfileAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const user = await devTimed("updateProfileAction:getUser", () => getServerAuthUser());
  if (!user) {
    redirect("/sign-in");
  }

  const supabase = await getServerSupabase();
  const displayName = String(formData.get("display_name") ?? "");
  const result = await devTimed("updateProfileAction:update", () =>
    updateOwnDisplayName(supabase, user.id, displayName),
  );
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/profile");
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

  const userId = user.id;

  try {
    const admin = createSecretSupabaseClient();
    const authDelete = await deleteAuthUserWithVerification(admin, userId);
    if (!authDelete.ok) {
      return {
        error:
          "Account deletion could not be completed. Your Hui account was not deleted. Try again or contact support if this continues.",
      };
    }
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        "Account deletion is not configured on this server. Try again later.",
    };
  }

  const { error: dataError } = await supabase.rpc("delete_my_account_data");
  if (dataError) {
    return {
      error:
        "Account deletion could not be completed. Your sign-in was removed but some Hui data may remain. Contact support.",
    };
  }

  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");
  redirect("/sign-in?deleted=1");
}
