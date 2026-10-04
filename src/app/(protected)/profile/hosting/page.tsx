import {
  HostingPreferencesSection,
  type HostingPreference,
} from "@/components/profile/hosting-preferences-section";
import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { SettingsSection } from "@/components/profile/settings-section";
import type { MemberHostingStanding } from "@/lib/groups/types";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";

export default async function ProfileHostingPage() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const { data: hostingRows } = await supabase
    .from("group_memberships")
    .select("group_id, hosting_standing, groups:group_id ( name )")
    .eq("user_id", user.id)
    .eq("status", "active");

  const hostingPreferences: HostingPreference[] = (hostingRows ?? [])
    .map((row) => {
      const raw = row.groups as { name: string } | { name: string }[] | null;
      const group = Array.isArray(raw) ? raw[0] : raw;
      return {
        groupId: row.group_id as string,
        groupName: group?.name ?? "Group",
        standing: (row.hosting_standing ?? "default") as MemberHostingStanding,
      };
    })
    .sort((a, b) => a.groupName.localeCompare(b.groupName));

  return (
    <ProfileSectionShell
      title="Hosting"
      description="Tell each group how you feel about hosting. Hui uses this when it suggests a host."
    >
      <SettingsSection
        title="Hosting preferences"
        description="You always get to accept or ask to swap when Hui suggests you as host."
      >
        <HostingPreferencesSection preferences={hostingPreferences} />
      </SettingsSection>
    </ProfileSectionShell>
  );
}
