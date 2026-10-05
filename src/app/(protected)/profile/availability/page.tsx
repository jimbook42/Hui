import { StandingAvailabilitySection } from "@/components/profile/standing-availability-section";
import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { SettingsSection } from "@/components/profile/settings-section";
import { listMyStandingAvailability } from "@/lib/availability/queries";
import { listActiveMembershipGroups } from "@/lib/groups/user-membership-groups";
import { getGroupSettingsByGroupId } from "@/lib/groups/settings-query";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";

export default async function ProfileAvailabilityPage() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const membershipGroups = await listActiveMembershipGroups(supabase, user.id);
  const windows = await listMyStandingAvailability(supabase, user.id);

  const groups = await Promise.all(
    membershipGroups.map(async (group) => {
      const settings = await getGroupSettingsByGroupId(supabase, group.groupId);
      return {
        groupId: group.groupId,
        groupName: group.groupName,
        timeZone: settings?.timezone ?? "Pacific/Auckland",
        windows: windows.filter((window) => window.groupId === group.groupId),
      };
    }),
  );

  groups.sort((a, b) => a.groupName.localeCompare(b.groupName));

  return (
    <ProfileSectionShell
      title="Usual availability"
      description="Tell each group when you are usually free. Hui uses this as a starting point when you respond to a hui — never as a commitment."
    >
      <SettingsSection
        title="Standing availability"
        description="Private to you. Other members do not see your weekly pattern."
      >
        <StandingAvailabilitySection groups={groups} />
      </SettingsSection>
    </ProfileSectionShell>
  );
}
