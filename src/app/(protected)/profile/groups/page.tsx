import { HouseholdSettingsSection } from "@/components/households/household-section";
import { ProfileMembershipGroupsSection } from "@/components/profile/profile-membership-groups-section";
import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { SettingsSection } from "@/components/profile/settings-section";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { listActiveMembershipGroups } from "@/lib/groups/user-membership-groups";
import { householdsEnabled } from "@/lib/features";
import { listUserHouseholdsByGroup } from "@/lib/households/queries";

export default async function ProfileGroupsPage() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const [{ data: profile }, membershipGroups] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    listActiveMembershipGroups(supabase, user.id),
  ]);
  const displayName = profile?.display_name?.trim() || user.email || "You";
  const householdContexts = householdsEnabled()
    ? await listUserHouseholdsByGroup(supabase, user.id, membershipGroups)
    : [];

  return (
    <ProfileSectionShell
      title="Hui groups"
      description={
        householdsEnabled()
          ? "Households and how you are grouped with others in each of your groups."
          : "Your groups on Hui."
      }
    >
      {householdsEnabled() ? (
        <SettingsSection
          title="Household"
          description="Manage how you are grouped with others in each of your groups. Households are separate from group membership."
        >
          <HouseholdSettingsSection contexts={householdContexts} currentUserId={user.id} />
        </SettingsSection>
      ) : (
        <SettingsSection
          title="Your groups"
          description="Groups you belong to and how you appear in each one."
        >
          <ProfileMembershipGroupsSection groups={membershipGroups} displayName={displayName} />
        </SettingsSection>
      )}
    </ProfileSectionShell>
  );
}
