import { HouseholdSettingsSection } from "@/components/households/household-section";
import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { SettingsSection } from "@/components/profile/settings-section";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { listActiveMembershipGroups } from "@/lib/groups/user-membership-groups";
import { listUserHouseholdsByGroup } from "@/lib/households/queries";

export default async function ProfileGroupsPage() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const membershipGroups = await listActiveMembershipGroups(supabase, user.id);
  const householdContexts = await listUserHouseholdsByGroup(supabase, user.id, membershipGroups);

  return (
    <ProfileSectionShell
      title="Hui groups"
      description="Households and how you are grouped with others in each of your groups."
    >
      <SettingsSection
        title="Household"
        description="Manage how you are grouped with others in each of your groups. Households are separate from group membership."
      >
        <HouseholdSettingsSection contexts={householdContexts} currentUserId={user.id} />
      </SettingsSection>
    </ProfileSectionShell>
  );
}
