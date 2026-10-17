import { AppShell } from "@/components/app/app-shell";
import { NotificationsListPaginated } from "@/components/notifications/notifications-list-paginated";
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
    ? await listMemberNotifications(supabase, user.id, { limit: 50, offset: 0 })
    : [];

  return (
    <AppShell
      title="Notifications"
      subtitle="What needs you, and what has changed. Private availability and dietary details never appear here."
    >
      <p className="mb-4 text-sm font-semibold text-muted-foreground">
        <a
          href="/profile/notifications#notification-settings"
          className="text-accent underline-offset-2 hover:underline hui-focus-ring rounded"
        >
          Too many notifications?
        </a>
      </p>
      <NotificationsListPaginated
        initialNotifications={notifications}
        initialHasMore={notifications.length === 50}
      />
    </AppShell>
  );
}
