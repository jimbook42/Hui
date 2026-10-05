"use server";

import { revalidatePath } from "next/cache";

import { parseHomeLocationForm } from "@/domain/profile/home-location";
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
  const displayName = normalizeDisplayName(String(formData.get("display_name") ?? ""));
  if (!displayName) {
    return { error: "Display name must be between 1 and 80 characters." };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      personal_setup_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  redirect("/dashboard");
}

export async function skipPersonalSetupAction(): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("profiles")
    .update({ personal_setup_completed_at: new Date().toISOString() })
    .eq("id", user.id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
