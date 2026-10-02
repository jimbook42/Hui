import {
  updateReconnectReminderPreferenceAction,
} from "@/app/notifications/actions";
import { AuthForm } from "@/components/auth/auth-form";

type NotificationPreferencesSectionProps = {
  reconnectRemindersEnabled: boolean;
};

export function NotificationPreferencesSection({
  reconnectRemindersEnabled,
}: NotificationPreferencesSectionProps) {
  return (
    <AuthForm
      action={updateReconnectReminderPreferenceAction}
      submitLabel="Save notification preferences"
      refreshOnSuccess
    >
      <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          name="member_reconnect_reminders_enabled"
          defaultChecked={reconnectRemindersEnabled}
          className="mt-1 h-4 w-4 rounded border-zinc-300"
        />
        <span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            Reconnect reminders
          </span>
          <span className="mt-1 block text-zinc-600 dark:text-zinc-400">
            When a group you belong to enables reconnect reminders and has been
            inactive, Hui can show an in-app reminder here. This does not create
            events or send email or push messages.
          </span>
        </span>
      </label>
    </AuthForm>
  );
}
