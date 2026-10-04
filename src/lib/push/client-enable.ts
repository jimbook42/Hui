import { registerPushSubscriptionAction } from "@/app/notifications/push-actions";
import { urlBase64ToUint8Array } from "@/lib/push/browser";

export type EnableWebPushResult =
  | {
      ok: true;
      permission: "granted";
      deviceSubscribed: boolean;
      webPushEnabled: boolean;
      subscriptionCount?: number;
      message?: string;
    }
  | {
      ok: false;
      permission: "default" | "granted" | "denied";
      error?: string;
    };

export function browserSupportsWebPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Request notification permission (when needed), subscribe via the service worker, and register
 * with Hui. Shared by Settings and the dashboard onboarding card.
 */
export async function enableWebPushNotifications(vapidPublicKey: string): Promise<EnableWebPushResult> {
  if (!browserSupportsWebPush()) {
    return { ok: false, permission: "denied", error: "Push is not supported on this browser." };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    const next = await Notification.requestPermission();
    permission =
      next === "granted" || next === "denied" ? next : "default";
  }

  if (permission !== "granted") {
    return {
      ok: false,
      permission,
      error:
        permission === "default"
          ? "Permission was dismissed. You can try again when you are ready."
          : undefined,
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));
  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys.auth) {
    return {
      ok: false,
      permission: "granted",
      error: "This browser could not create a push subscription.",
    };
  }

  const result = await registerPushSubscriptionAction({
    endpoint: subscription.endpoint,
    p256dh: json.keys.p256dh,
    authKey: json.keys.auth,
  });

  if (result.error) {
    return { ok: false, permission: "granted", error: result.error };
  }

  return {
    ok: true,
    permission: "granted",
    deviceSubscribed: result.deviceSubscribed !== false,
    webPushEnabled: true,
    subscriptionCount: result.subscriptionCount,
    message: result.message ?? "Push notifications are on for this browser.",
  };
}
