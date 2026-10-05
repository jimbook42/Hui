import {
  updateReconnectReminderPreferenceAction,
  updatePushNotificationPreferencesAction,
} from "@/app/notifications/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { HuiSwitchField } from "@/components/hui/hui-switch";

type NotificationPreferencesSectionProps = {
  reconnectRemindersEnabled: boolean;
  pushPreferences: {
    eventProposalsEnabled: boolean;
    consensusReadyEnabled: boolean;
    eventConfirmedEnabled: boolean;
    hostAssignmentEnabled: boolean;
    contributionChangesEnabled: boolean;
  };
};

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
          Choose which Hui notifications can interrupt you. In-app notifications remain available.
        </p>
        <AuthForm
          action={updatePushNotificationPreferencesAction}
          submitLabel="Save push preferences"
          refreshOnSuccess
        >
          <div className="space-y-3">
            <PushPreference
              name="push_event_proposals_enabled"
              label="Event proposed"
              defaultChecked={pushPreferences.eventProposalsEnabled}
            />
            <PushPreference
              name="push_consensus_ready_enabled"
              label="Decision ready"
              defaultChecked={pushPreferences.consensusReadyEnabled}
            />
            <PushPreference
              name="push_event_confirmed_enabled"
              label="Event confirmed"
              defaultChecked={pushPreferences.eventConfirmedEnabled}
            />
            <PushPreference
              name="push_host_assignment_enabled"
              label="Host assignment"
              defaultChecked={pushPreferences.hostAssignmentEnabled}
            />
            <PushPreference
              name="push_contribution_changes_enabled"
              label="Contribution changes"
              defaultChecked={pushPreferences.contributionChangesEnabled}
            />
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
            description="When a group you belong to enables reconnect reminders and has been inactive, Hui can show an in-app reminder here."
            defaultChecked={reconnectRemindersEnabled}
          />
        </AuthForm>
      </div>
    </div>
  );
}

function PushPreference({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <HuiSwitchField name={name} label={label} defaultChecked={defaultChecked} />
  );
}
