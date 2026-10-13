import { DietarySettingsSection } from "@/components/dietary/dietary-settings-section";
import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { SettingsSection } from "@/components/profile/settings-section";
import { listUserDietaryEntries, listUserGroupsForDietary } from "@/lib/dietary/queries";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { listActiveMembershipGroups } from "@/lib/groups/user-membership-groups";

export default async function ProfileDietaryPage() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const membershipGroups = await listActiveMembershipGroups(supabase, user.id);
  const [dietaryEntries, dietaryGroups] = await Promise.all([
    listUserDietaryEntries(supabase),
    listUserGroupsForDietary(supabase, user.id, membershipGroups),
  ]);

  return (
    <ProfileSectionShell
      title="Dietary & food"
      description="Record dietary information once. It stays private until you choose to share it."
    >
      <SettingsSection
        title="Dietary information"
        description="Sharing is controlled for all your entries at once — not one requirement at a time."
      >
        <DietarySettingsSection entries={dietaryEntries} groups={dietaryGroups} />
      </SettingsSection>
    </ProfileSectionShell>
  );
}
