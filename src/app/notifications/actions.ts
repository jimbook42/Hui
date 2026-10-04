"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { notificationHref, type MemberNotification } from "@/lib/notifications/types";
import { createClient } from "@/lib/supabase/server";

export type NotificationActionState = {
  error?: string;
  message?: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }
  return { supabase, user };
}

export async function markNotificationReadAction(
  _prev: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const notificationId = String(formData.get("notification_id") ?? "").trim();
  if (!notificationId) {
    return { error: "Notification not found." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/notifications");
  return { message: "Marked as read." };
}

export async function markAllNotificationsReadFormAction(): Promise<void> {
  await markAllNotificationsReadAction();
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_all_notifications_read");

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/notifications");
  return { message: "All notifications marked as read." };
}

export async function updateReconnectReminderPreferenceAction(
  _prev: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const enabled = formData.get("member_reconnect_reminders_enabled") === "on";

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ member_reconnect_reminders_enabled: enabled })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/notifications");
  return { message: "Notification preferences saved." };
}

export async function updatePushNotificationPreferencesAction(
  _prev: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const preferences = {
    push_event_proposals_enabled: formData.get("push_event_proposals_enabled") === "on",
    push_consensus_ready_enabled: formData.get("push_consensus_ready_enabled") === "on",
    push_event_confirmed_enabled: formData.get("push_event_confirmed_enabled") === "on",
    push_host_assignment_enabled: formData.get("push_host_assignment_enabled") === "on",
    push_contribution_changes_enabled: formData.get("push_contribution_changes_enabled") === "on",
  };

  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update(preferences)
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { message: "Push notification preferences saved." };
}

export async function markNotificationReadByIdAction(
  notificationId: string,
): Promise<NotificationActionState> {
  const trimmed = notificationId.trim();
  if (!trimmed) {
    return { error: "Notification not found." };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: trimmed,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/notifications");
  return { message: "Marked as read." };
}

export async function openNotificationAction(formData: FormData): Promise<void> {
  const notificationId = String(formData.get("notification_id") ?? "").trim();
  const groupId = String(formData.get("group_id") ?? "").trim();
  const eventIdRaw = String(formData.get("event_id") ?? "").trim();
  const eventId = eventIdRaw.length > 0 ? eventIdRaw : null;
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const kind = (kindRaw || "event_confirmed") as MemberNotification["kind"];

  if (!notificationId || !groupId) {
    redirect("/notifications");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });

  revalidatePath("/notifications");
  redirect(notificationHref({ groupId, eventId, kind }));
}
