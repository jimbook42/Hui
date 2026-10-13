import { NotificationPreferencesSection } from "@/components/profile/notification-preferences-section";
import { PushNotificationsControl } from "@/components/profile/push-notifications-control";
import { ProfileSectionShell } from "@/components/profile/profile-hub-link";
import { SettingsSection } from "@/components/profile/settings-section";
import { getMemberReconnectPreference } from "@/lib/notifications/queries";
import { getVapidPublicKey } from "@/lib/push/config";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";

export default async function ProfileNotificationsPage() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const [profile, reconnectPref, pushState] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "push_event_proposals_enabled, push_consensus_ready_enabled, push_event_confirmed_enabled, push_host_assignment_enabled, push_contribution_changes_enabled",
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
  ]);

  const {
    vapidPublicKey,
    pushConfigured,
    webPushEnabled,
    pushSubscriptionCount,
  } = pushState;

  return (
    <ProfileSectionShell
      title="Notifications"
      description="In-app updates stay in Hui. Push is optional."
    >
      <SettingsSection
        title="Notifications"
        description="Push only alerts you about the same updates you would see in Hui."
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
    </ProfileSectionShell>
  );
}
