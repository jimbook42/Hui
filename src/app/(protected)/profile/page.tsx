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
import { SettingsSection } from "@/components/profile/settings-section";
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

  const [profile, reconnectPref, pushState, householdContexts, dietaryEntries, dietaryGroups] =
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
      ]),
    );

  const authMethods = authMethodLabelsForUser(user);
  const {
    vapidPublicKey,
    pushConfigured,
    webPushEnabled,
    pushSubscriptionCount,
  } = pushState;

  return (
    <AppShell title="Account settings">
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        Manage your Hui profile and sign-in details.
      </p>

      <div className="space-y-8">
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

          <dl className="mt-6 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <div>
              <dt className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Account email
              </dt>
              <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {user.email ?? "—"}
              </dd>
              <p className="mt-1 text-xs text-zinc-500">
                Used to sign in. Contact support if you need to change it.
              </p>
            </div>

            {authMethods.length > 0 ? (
              <div>
                <dt className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Sign-in methods
                </dt>
                <dd className="mt-2">
                  <ul className="flex flex-wrap gap-2">
                    {authMethods.map((method) => (
                      <li
                        key={method}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                      >
                        {method}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}

            <div>
              <dt className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Member ID
              </dt>
              <dd className="mt-1 font-mono text-xs break-all text-zinc-600 dark:text-zinc-400">
                {user.id}
              </dd>
              <p className="mt-1 text-xs text-zinc-500">
                Share this with a group admin if they need to add you to a group.
              </p>
            </div>
          </dl>
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
          <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
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
