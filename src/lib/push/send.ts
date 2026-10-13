import "server-only";

import { sendNotification, WebPushError } from "web-push";

import type { PushSubscriptionTarget } from "./deliver";
import type { PushPayload } from "./payload";
import { getVapidConfig } from "./config";

export async function sendWebPush(
  subscription: PushSubscriptionTarget,
  payload: PushPayload,
): Promise<void> {
  const vapid = getVapidConfig();
  if (!vapid) {
    throw new Error("vapid_unconfigured");
  }

  const topic = payload.notificationId.replace(/-/g, "").slice(0, 32);
  try {
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.authKey,
        },
      },
      JSON.stringify(payload),
      {
        TTL: 60,
        urgency: "normal",
        topic,
        vapidDetails: {
          subject: vapid.subject,
          publicKey: vapid.publicKey,
          privateKey: vapid.privateKey,
        },
      },
    );
  } catch (error) {
    if (error instanceof WebPushError) {
      const failure = new Error("web_push_rejected");
      (failure as Error & { statusCode?: number }).statusCode = error.statusCode;
      throw failure;
    }
    throw error;
  }
}
