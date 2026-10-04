import "server-only";

import { cache } from "react";

import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { countUnreadNotifications } from "@/lib/notifications/queries";

/** Unread in-app notifications for the current user — one query per request, shared by header + nav. */
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const user = await getServerAuthUser();
  if (!user) {
    return 0;
  }
  const supabase = await getServerSupabase();
  return countUnreadNotifications(supabase, user.id);
});
