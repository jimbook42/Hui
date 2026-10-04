import {
  updateReconnectReminderPreferenceAction,
  updatePushNotificationPreferencesAction,
} from "@/app/notifications/actions";
import { AuthForm } from "@/components/auth/auth-form";

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
          <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              name="member_reconnect_reminders_enabled"
              defaultChecked={reconnectRemindersEnabled}
              className="mt-1 h-4 w-4 rounded"
            />
            <span>
              <span className="font-medium text-foreground">
                Reconnect reminders
              </span>
              <span className="mt-1 block text-muted-foreground">
                When a group you belong to enables reconnect reminders and has been inactive, Hui
                can show an in-app reminder here.
              </span>
            </span>
          </label>
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
    <label className="flex cursor-pointer items-center justify-between gap-4 text-sm text-foreground">
      <span>{label}</span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded"
      />
    </label>
  );
}
