import "server-only";

import { createSecretSupabaseClient } from "@/lib/supabase/admin";

import { getVapidConfig } from "./config";
import { deliverNotificationPush, type PushSubscriptionTarget } from "./deliver";
import type { PushDeliveryStatus } from "./deliver";
import { sendWebPush } from "./send";

const BATCH_LIMIT = 20;
const SENDING_STALE_MS = 15 * 60 * 1000;

type OutboxNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  group_id: string;
  event_id: string | null;
};

type OutboxRow = {
  id: string;
  notification_id: string;
  user_id: string;
  attempts: number;
  status: string;
  created_at: string;
  updated_at: string;
  member_notifications: OutboxNotification | OutboxNotification[] | null;
  profiles: { web_push_enabled: boolean } | { web_push_enabled: boolean }[] | null;
};

export type PushDrainSummary = {
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  removed: number;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function emptySummary(): PushDrainSummary {
  return { claimed: 0, sent: 0, skipped: 0, failed: 0, removed: 0 };
}

export async function drainPushOutbox(): Promise<PushDrainSummary> {
  if (!getVapidConfig() || !process.env.SUPABASE_SECRET_KEY?.trim()) {
    return emptySummary();
  }

  const admin = createSecretSupabaseClient();
  const { data, error } = await admin
    .from("notification_push_outbox")
    .select(
      "id, notification_id, user_id, attempts, status, created_at, updated_at, member_notifications ( id, kind, title, body, group_id, event_id ), profiles ( web_push_enabled )",
    )
    .in("status", ["pending", "sending"])
    .order("created_at", { ascending: true })
    .limit(40);

  if (error || !data) {
    throw new Error("push_outbox_read_failed");
  }

  const staleBefore = Date.now() - SENDING_STALE_MS;
  const candidates = (data as unknown as OutboxRow[])
    .filter((row) => {
      if (row.status === "pending") {
        return true;
      }
      return new Date(row.updated_at).getTime() < staleBefore;
    })
    .slice(0, BATCH_LIMIT);

  const summary = emptySummary();
  const subscriptionsByUser = new Map<string, PushSubscriptionTarget[]>();

  for (const row of candidates) {
    const claimed = await admin
      .from("notification_push_outbox")
      .update({
        status: "sending",
        attempts: row.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", row.status)
      .select("id");

    if (claimed.error || (claimed.data?.length ?? 0) !== 1) {
      continue;
    }
    summary.claimed += 1;

    const notification = one(row.member_notifications);
    const profile = one(row.profiles);
    let subscriptions: PushSubscriptionTarget[] = [];
    if (profile?.web_push_enabled) {
      subscriptions = await loadSubscriptions(admin, row.user_id, subscriptionsByUser);
    }

    const result = await deliverNotificationPush({
      id: notification?.id ?? row.notification_id,
      kind: notification?.kind ?? "",
      title: notification?.title ?? "",
      body: notification?.body ?? "",
      eventId: notification?.event_id ?? null,
      groupId: notification?.group_id ?? "",
      webPushEnabled: profile?.web_push_enabled === true,
      createdAt: row.created_at,
      subscriptions,
      sender: sendWebPush,
    });

    if (result.removeSubscriptionIds.length > 0) {
      const removed = await admin
        .from("push_subscriptions")
        .delete()
        .in("id", result.removeSubscriptionIds);
      if (!removed.error) {
        summary.removed += result.removeSubscriptionIds.length;
        subscriptionsByUser.delete(row.user_id);
      }
    }

    const attempts = row.attempts + 1;
    const finalStatus: PushDeliveryStatus | "pending" =
      result.status === "failed" && attempts < 3 ? "pending" : result.status;

    await admin
      .from("notification_push_outbox")
      .update({
        status: finalStatus,
        detail: result.detail.slice(0, 300),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (finalStatus === "sent") {
      summary.sent += 1;
    } else if (finalStatus === "skipped") {
      summary.skipped += 1;
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}

async function loadSubscriptions(
  admin: ReturnType<typeof createSecretSupabaseClient>,
  userId: string,
  cache: Map<string, PushSubscriptionTarget[]>,
): Promise<PushSubscriptionTarget[]> {
  const cached = cache.get(userId);
  if (cached) {
    return cached;
  }
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId);
  if (error || !data) {
    cache.set(userId, []);
    return [];
  }
  const subscriptions = data.map((row) => ({
    id: String(row.id),
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    authKey: String(row.auth_key),
  }));
  cache.set(userId, subscriptions);
  return subscriptions;
}
