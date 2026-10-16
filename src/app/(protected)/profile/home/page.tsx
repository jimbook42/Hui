import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { HomeLocationSection } from "@/components/profile/home-location-section";
import { SettingsSection } from "@/components/profile/settings-section";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { fetchMyHomeLocation } from "@/lib/profiles/home-location-query";

export default async function ProfileHomePage() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const home = await fetchMyHomeLocation(supabase, user.id);

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
