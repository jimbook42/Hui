import { AppShell } from "@/components/app/app-shell";
import { NotificationsList } from "@/components/notifications/notifications-list";
import {
  listMemberNotifications,
  syncReconnectReminders,
} from "@/lib/notifications/queries";
import { schedulePushDelivery } from "@/lib/push/schedule";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await syncReconnectReminders(supabase);
  schedulePushDelivery();

  const notifications = user
    ? await listMemberNotifications(supabase, user.id)
    : [];

  return (
    <AppShell title="Notifications">
      <p className="mb-6 hui-type-supporting">
        Updates about events and groups you belong to. Hui does not expose private
        availability or dietary details in notifications.
      </p>
      <NotificationsList notifications={notifications} />
    </AppShell>
  );
}
