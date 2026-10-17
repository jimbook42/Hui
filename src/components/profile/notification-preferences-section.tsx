import {
  updateReconnectReminderPreferenceAction,
  updatePushNotificationPreferencesAction,
} from "@/app/notifications/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { HuiSwitchField } from "@/components/hui/hui-switch";
import { PUSH_CONTRIBUTION_CHANGES_DESCRIPTION } from "@/domain/notifications/push-preference-copy";

type NotificationPreferencesSectionProps = {
  reconnectRemindersEnabled: boolean;
  pushPreferences: {
    newProposedTimeAlertsEnabled: boolean;
    eventProposalsEnabled: boolean;
    consensusReadyEnabled: boolean;
    eventConfirmedEnabled: boolean;
    hostAssignmentEnabled: boolean;
    contributionChangesEnabled: boolean;
  };
};

const PUSH_TYPE_COPY: {
  name: string;
  label: string;
  description: string;
  key: keyof NotificationPreferencesSectionProps["pushPreferences"];
}[] = [
  {
    name: "new_proposed_time_alerts_enabled",
    label: "New times added",
    description:
      "When someone adds another time after you have already answered (in Hui and as a push if push is on).",
    key: "newProposedTimeAlertsEnabled",
  },
  {
    name: "push_event_proposals_enabled",
    label: "New hui proposed",
    description: "When someone suggests a new hui for your group.",
    key: "eventProposalsEnabled",
  },
  {
    name: "push_consensus_ready_enabled",
    label: "Ready to confirm a time",
    description: "When enough people have answered and a time can be locked in.",
    key: "consensusReadyEnabled",
  },
  {
    name: "push_event_confirmed_enabled",
    label: "Hui confirmed",
    description: "When the date and time are set for a hui.",
    key: "eventConfirmedEnabled",
  },
  {
    name: "push_host_assignment_enabled",
    label: "Hosting updates",
    description: "When you are asked to host or your hosting changes.",
    key: "hostAssignmentEnabled",
  },
  {
    name: "push_contribution_changes_enabled",
    label: "What to bring",
    description: PUSH_CONTRIBUTION_CHANGES_DESCRIPTION,
    key: "contributionChangesEnabled",
  },
];

export function NotificationPreferencesSection({
  reconnectRemindersEnabled,
  pushPreferences,
}: NotificationPreferencesSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-foreground">
          Push notification types
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose what can buzz your phone. You will still see everything in Hui when you open the app.
        </p>
        <AuthForm
          action={updatePushNotificationPreferencesAction}
          submitLabel="Save push preferences"
          refreshOnSuccess
        >
          <div className="space-y-3">
            {PUSH_TYPE_COPY.map((item) => (
              <HuiSwitchField
                key={item.name}
                name={item.name}
                label={item.label}
                description={item.description}
                defaultChecked={pushPreferences[item.key]}
              />
            ))}
          </div>
        </AuthForm>
      </div>

      <div className="pt-6">
        <AuthForm
          action={updateReconnectReminderPreferenceAction}
          submitLabel="Save in-app preferences"
          refreshOnSuccess
        >
          <HuiSwitchField
            name="member_reconnect_reminders_enabled"
            label="Reconnect reminders"
            description="In-app only: when a group has been quiet for a while, Hui can nudge you here."
            defaultChecked={reconnectRemindersEnabled}
          />
        </AuthForm>
      </div>
    </div>
  );
}
