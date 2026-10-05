"use server";

import { revalidatePath } from "next/cache";

import { parseHomeLocationForm } from "@/domain/profile/home-location";
import { parsePersonalSetupFormData } from "@/domain/profile/personal-setup-update";
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

  const { error } = await supabase
    .from("profiles")
    .update({
      home_location_label: home?.label ?? null,
      home_location_lat: home?.coordinates?.lat ?? null,
      home_location_lng: home?.coordinates?.lng ?? null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
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

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);

  if (error) {
    return { error: error.message };
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
    update.display_name = patch.displayName;
  }
  if (patch.home !== undefined) {
    update.home_location_label = patch.home?.label ?? null;
    update.home_location_lat = patch.home?.coordinates?.lat ?? null;
    update.home_location_lng = patch.home?.coordinates?.lng ?? null;
  }

  await supabase.from("profiles").update(update).eq("id", user.id);
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  redirect("/dashboard");
}
