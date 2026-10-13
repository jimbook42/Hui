import { HuiSurface } from "@/components/hui/hui-surface";
import { PersonalSetupFlow } from "@/components/profile/personal-setup-flow";
import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { homeLocationFromProfileRow } from "@/domain/profile/home-location";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";

export default async function ProfileSetupPage() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "display_name, personal_setup_completed_at, home_location_label, home_location_lat, home_location_lng",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.personal_setup_completed_at) {
    redirect("/profile");
  }

  const home = profile ? homeLocationFromProfileRow(profile) : null;

  return (
    <ProfileSectionShell
      title="Get started"
      description="Lightweight setup for your account — nothing here is required for every group."
    >
      <HuiSurface padding="lg" shape="organic" elevated>
        <PersonalSetupFlow
          defaultDisplayName={profile?.display_name ?? user.email ?? ""}
          home={home}
        />
      </HuiSurface>
    </ProfileSectionShell>
  );
}
