import { updateProfileAction } from "@/app/auth/actions";
import { AccountActionsSection } from "@/components/profile/account-actions-section";
import { AppShell } from "@/components/app/app-shell";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { DietarySettingsSection } from "@/components/dietary/dietary-settings-section";
import { HouseholdSettingsSection } from "@/components/households/household-section";
import { listUserDietaryEntries, listUserGroupsForDietary } from "@/lib/dietary/queries";
import { NotificationPreferencesSection } from "@/components/profile/notification-preferences-section";
import { PushNotificationsControl } from "@/components/profile/push-notifications-control";
import { getMemberReconnectPreference } from "@/lib/notifications/queries";
import { getVapidPublicKey } from "@/lib/push/config";
import { InstallHuiSettings } from "@/components/pwa/install-hui";
import { SettingsSection } from "@/components/profile/settings-section";
import { HostingPreferencesSection, type HostingPreference } from "@/components/profile/hosting-preferences-section";
import { ThemeToggle } from "@/components/profile/theme-toggle";
import { HuiSurface } from "@/components/hui/hui-surface";
import { avatarToneClass, initialsFor } from "@/components/hui/avatar-stack";
import { cn } from "@/lib/ui/cn";
import type { MemberHostingStanding } from "@/lib/groups/types";
import { authMethodLabelsForUser } from "@/lib/auth/auth-methods";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { listActiveMembershipGroups } from "@/lib/groups/user-membership-groups";
import { listUserHouseholdsByGroup } from "@/lib/households/queries";
import { devTimed } from "@/lib/perf/dev-server-timing";

export default async function ProfilePage() {
  const user = await devTimed("profile-page:getUser", () => getServerAuthUser());
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();

  const membershipGroups = await devTimed("profile-page:membership-groups", () =>
    listActiveMembershipGroups(supabase, user.id),
  );

  const [
    profile,
    reconnectPref,
    pushState,
    householdContexts,
    dietaryEntries,
    dietaryGroups,
    hostingRows,
  ] =
    await devTimed("profile-page:data", () =>
      Promise.all([
        supabase
          .from("profiles")
          .select(
            "display_name, push_event_proposals_enabled, push_consensus_ready_enabled, push_event_confirmed_enabled, push_host_assignment_enabled, push_contribution_changes_enabled",
          )
          .eq("id", user.id)
          .maybeSingle()
          .then(({ data }) => data),
        getMemberReconnectPreference(supabase, user.id),
        (async () => {
          const vapidPublicKey = getVapidPublicKey();
          if (!vapidPublicKey) {
            return {
              vapidPublicKey: null as string | null,
              pushConfigured: false,
              webPushEnabled: false,
              pushSubscriptionCount: 0,
            };
          }
          const { data, error } = await supabase.rpc("my_push_subscription_state", {
            p_endpoint: "",
          });
          const row = !error && Array.isArray(data) ? data[0] : null;
          if (!row || typeof row !== "object") {
            return {
              vapidPublicKey,
              pushConfigured: false,
              webPushEnabled: false,
              pushSubscriptionCount: 0,
            };
          }
          const count = (row as { subscription_count?: number }).subscription_count;
          return {
            vapidPublicKey,
            pushConfigured: true,
            webPushEnabled: (row as { web_push_enabled?: boolean }).web_push_enabled === true,
            pushSubscriptionCount: typeof count === "number" ? count : 0,
          };
        })(),
        listUserHouseholdsByGroup(supabase, user.id, membershipGroups),
        listUserDietaryEntries(supabase),
        listUserGroupsForDietary(supabase, user.id, membershipGroups),
        supabase
          .from("group_memberships")
          .select("group_id, hosting_standing, groups:group_id ( name )")
          .eq("user_id", user.id)
          .eq("status", "active")
          .then(({ data }) => data ?? []),
      ]),
    );

  const authMethods = authMethodLabelsForUser(user);
  const hostingPreferences: HostingPreference[] = hostingRows
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
  const displayName = profile?.display_name?.trim() || user.email || "You";
  const {
    vapidPublicKey,
    pushConfigured,
    webPushEnabled,
    pushSubscriptionCount,
  } = pushState;

  return (
    <AppShell title="Account settings" subtitle="Your profile, how you like to gather, and how Hui reaches you.">
      <div className="space-y-6">
        <HuiSurface tone="sage" shape="organic" padding="lg" className="hui-rise flex items-center gap-4">
          <span
            aria-hidden="true"
            className={cn(
              "hui-shape-blob-a flex h-16 w-16 shrink-0 items-center justify-center text-xl font-black text-foreground",
              avatarToneClass(user.id),
            )}
          >
            {initialsFor(displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold text-foreground">{displayName}</p>
            <p className="truncate text-sm font-semibold text-muted-foreground">{user.email ?? ""}</p>
          </div>
        </HuiSurface>

        <SettingsSection
          title="Profile"
          description="Your display name is visible to people who share a group with you."
        >
          <AuthForm action={updateProfileAction} submitLabel="Save display name">
            <AuthField
              label="Display name"
              name="display_name"
              autoComplete="name"
              defaultValue={profile?.display_name ?? ""}
            />
          </AuthForm>

          <dl className="mt-6 space-y-4 pt-6">
            <div>
              <dt className="text-sm font-bold text-foreground">
                Account email
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {user.email ?? "—"}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Used to sign in. Contact support if you need to change it.
              </p>
            </div>

            {authMethods.length > 0 ? (
              <div>
                <dt className="text-sm font-bold text-foreground">
                  Sign-in methods
                </dt>
                <dd className="mt-2">
                  <ul className="flex flex-wrap gap-2">
                    {authMethods.map((method) => (
                      <li
                        key={method}
                        className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {method}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}

            <div>
              <dt className="text-sm font-bold text-foreground">
                Member ID
              </dt>
              <dd className="mt-1 font-mono text-xs break-all text-muted-foreground">
                {user.id}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Share this with a group admin if they need to add you to a group.
              </p>
            </div>
          </dl>
        </SettingsSection>

        <SettingsSection
          title="Appearance"
          description="Choose how Hui looks on this device."
        >
          <ThemeToggle />
        </SettingsSection>

        <SettingsSection
          title="Add Hui to your home screen"
          description="Hui works as an app on your phone or computer. No app store needed."
        >
          <InstallHuiSettings />
        </SettingsSection>

        <SettingsSection
          title="Hosting"
          description="Tell each group how you feel about hosting. Hui uses this when it suggests a host; you always get to accept or ask to swap."
        >
          <HostingPreferencesSection preferences={hostingPreferences} />
        </SettingsSection>

        <SettingsSection
          title="Dietary information"
          description="Record dietary information once. It stays private until you choose to share it with a group for event planning."
        >
          <DietarySettingsSection entries={dietaryEntries} groups={dietaryGroups} />
        </SettingsSection>

        <SettingsSection
          title="Household"
          description="Manage how you are grouped with others in each of your groups. Households are separate from group membership."
        >
          <HouseholdSettingsSection contexts={householdContexts} currentUserId={user.id} />
        </SettingsSection>

        <SettingsSection
          title="Notifications"
          description="In-app updates stay in Hui. Push is optional and only alerts you about those same updates."
        >
          <PushNotificationsControl
            key={`${webPushEnabled}:${pushSubscriptionCount}`}
            configured={pushConfigured}
            vapidPublicKey={pushConfigured ? vapidPublicKey : null}
            webPushEnabled={webPushEnabled}
            subscriptionCount={pushSubscriptionCount}
          />
          <div className="mt-6 pt-6">
            <NotificationPreferencesSection
              reconnectRemindersEnabled={reconnectPref}
              pushPreferences={{
                eventProposalsEnabled: profile?.push_event_proposals_enabled !== false,
                consensusReadyEnabled: profile?.push_consensus_ready_enabled !== false,
                eventConfirmedEnabled: profile?.push_event_confirmed_enabled !== false,
                hostAssignmentEnabled: profile?.push_host_assignment_enabled !== false,
                contributionChangesEnabled: profile?.push_contribution_changes_enabled !== false,
              }}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title="Account"
          description="Sign out or permanently delete your Hui account."
        >
          <AccountActionsSection />
        </SettingsSection>
      </div>
    </AppShell>
  );
}
