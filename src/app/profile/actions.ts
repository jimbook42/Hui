"use server";

import { revalidatePath } from "next/cache";

import { parseHomeLocationForm } from "@/domain/profile/home-location";
import { parsePersonalSetupFormData } from "@/domain/profile/personal-setup-update";
import {
  DISPLAY_NAME_CONFIRMED_METADATA_KEY,
  displayNameMatchesEmailPrefix,
} from "@/lib/profiles/display-name-prompt";
import { updateOwnDisplayName } from "@/lib/profiles/update-display-name";
import { normalizeDisplayName } from "@/lib/profiles/validation";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type ProfileActionState = {
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

async function markDisplayNameConfirmed(supabase: Awaited<ReturnType<typeof createClient>>) {
  await supabase.auth.updateUser({
    data: {
      [DISPLAY_NAME_CONFIRMED_METADATA_KEY]: true,
    },
  });
}

export async function saveDisplayNameFromPromptAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const raw = String(formData.get("display_name") ?? "");
  const { supabase, user } = await requireUser();
  const result = await updateOwnDisplayName(supabase, user.id, raw, { email: user.email });
  if (!result.ok) {
    return { error: result.error };
  }

  const normalized = normalizeDisplayName(raw);
  if (
    normalized &&
    displayNameMatchesEmailPrefix(normalized, user.email)
  ) {
    await markDisplayNameConfirmed(supabase);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function dismissDisplayNamePromptAction(): Promise<void> {
  const { supabase } = await requireUser();
  await markDisplayNameConfirmed(supabase);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateHomeLocationAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = parseHomeLocationForm(
    formData.get("home_location_label"),
    formData.get("home_location_lat"),
    formData.get("home_location_lng"),
  );
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const { supabase, user } = await requireUser();
  const home = parsed.home;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      home_location_label: home?.label ?? null,
      home_location_lat: home?.coordinates?.lat ?? null,
      home_location_lng: home?.coordinates?.lng ?? null,
    })
    .eq("id", user.id)
    .select("id");

  if (error) {
    return { error: error.message };
  }
  if (!data?.length) {
    return { error: "Profile not found." };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/home");
  revalidatePath("/profile/setup");
  return { message: home ? "Home saved." : "Home cleared." };
}

export async function completePersonalSetupAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const patch = parsePersonalSetupFormData(formData);
  const displayName = patch.displayName ?? "";
  if (!displayName) {
    return { error: "Display name must be between 1 and 80 characters." };
  }

  const { supabase, user } = await requireUser();
  const update: Record<string, unknown> = {
    display_name: displayName,
    personal_setup_completed_at: new Date().toISOString(),
  };
  if (patch.home !== undefined) {
    update.home_location_label = patch.home?.label ?? null;
    update.home_location_lat = patch.home?.coordinates?.lat ?? null;
    update.home_location_lng = patch.home?.coordinates?.lng ?? null;
  }

  const result = await updateOwnDisplayName(supabase, user.id, displayName, {
    email: user.email,
  });
  if (!result.ok) {
    return { error: result.error };
  }

  const { error: setupError } = await supabase
    .from("profiles")
    .update({
      personal_setup_completed_at: update.personal_setup_completed_at,
      ...(patch.home !== undefined
        ? {
            home_location_label: update.home_location_label,
            home_location_lat: update.home_location_lat,
            home_location_lng: update.home_location_lng,
          }
        : {}),
    })
    .eq("id", user.id)
    .select("id");

  if (setupError) {
    return { error: setupError.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  redirect("/dashboard");
}

export async function skipPersonalSetupAction(formData: FormData): Promise<void> {
  const patch = parsePersonalSetupFormData(formData);
  const { supabase, user } = await requireUser();

  const update: Record<string, unknown> = {
    personal_setup_completed_at: new Date().toISOString(),
  };
  if (patch.displayName) {
    const result = await updateOwnDisplayName(supabase, user.id, patch.displayName, {
      email: user.email,
    });
    if (!result.ok) {
      throw new Error(result.error);
    }
  }
  if (patch.home !== undefined) {
    update.home_location_label = patch.home?.label ?? null;
    update.home_location_lat = patch.home?.coordinates?.lat ?? null;
    update.home_location_lng = patch.home?.coordinates?.lng ?? null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("id");
  if (error) {
    throw new Error(error.message);
  }
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  redirect("/dashboard");
}
