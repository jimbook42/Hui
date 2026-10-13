import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { HomeLocationSection } from "@/components/profile/home-location-section";
import { SettingsSection } from "@/components/profile/settings-section";
import { homeLocationFromProfileRow } from "@/domain/profile/home-location";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";

export default async function ProfileHomePage() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("home_location_label, home_location_lat, home_location_lng")
    .eq("id", user.id)
    .maybeSingle();

  const home = profile ? homeLocationFromProfileRow(profile) : null;

  return (
    <ProfileSectionShell
      title="Home"
      description="Save where you live so hosting can be as simple as choosing “At my home”."
    >
      <SettingsSection
        title="Where is home?"
        description="This helps Hui suggest hosts without repeatedly asking you. You can change it any time."
      >
        <HomeLocationSection home={home} />
      </SettingsSection>
    </ProfileSectionShell>
  );
}
