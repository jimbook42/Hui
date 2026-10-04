import Link from "next/link";

import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { countUnreadNotifications } from "@/lib/notifications/queries";

export async function NotificationsNavLink() {
  const user = await getServerAuthUser();

  if (!user) {
    return null;
  }

  const supabase = await getServerSupabase();
  const unread = await countUnreadNotifications(supabase, user.id);

  return (
    <Link
      href="/notifications"
      className="relative text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
    >
      Notifications
      {unread > 0 ? (
        <span
          className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-sky-600 px-1.5 py-0.5 text-xs font-semibold text-white"
          aria-label={`${unread} unread notifications`}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
