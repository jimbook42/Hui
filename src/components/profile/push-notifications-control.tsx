"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  disablePushNotificationsAction,
  readPushDeviceStateAction,
  registerPushSubscriptionAction,
} from "@/app/notifications/push-actions";
import { urlBase64ToUint8Array } from "@/lib/push/browser";
import { resolvePushSettingsView } from "@/lib/push/settings-state";

type PushNotificationsControlProps = {
  configured: boolean;
  vapidPublicKey: string | null;
  webPushEnabled: boolean;
  subscriptionCount: number;
};

const buttonClassName =
  "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800/50";

function browserSupportsPush(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushNotificationsControl({
  configured,
  vapidPublicKey,
  webPushEnabled,
  subscriptionCount,
}: PushNotificationsControlProps) {
  const router = useRouter();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<"default" | "granted" | "denied">("default");
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [accountEnabled, setAccountEnabled] = useState(webPushEnabled);
  const [savedCount, setSavedCount] = useState(subscriptionCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const supportedBrowser = browserSupportsPush();
      if (cancelled) {
        return;
      }
      setSupported(supportedBrowser);
      if (!supportedBrowser) {
        return;
      }
      setPermission(Notification.permission);
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        const endpoint = subscription?.endpoint ?? null;
        const state = await readPushDeviceStateAction(endpoint);
        if (cancelled || state.error) {
          return;
        }
        setDeviceSubscribed(state.deviceSubscribed === true);
        setAccountEnabled(state.webPushEnabled === true);
        if (typeof state.subscriptionCount === "number") {
          setSavedCount(state.subscriptionCount);
        }
      } catch {
        if (!cancelled) {
          setDeviceSubscribed(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const view = resolvePushSettingsView({
    configured,
    supported: configured ? supported : false,
    permission,
    webPushEnabled: accountEnabled,
    deviceSubscribed,
  });

  async function enable() {
    if (!vapidPublicKey || !browserSupportsPush()) {
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const nextPermission = await Notification.requestPermission();
      const normalized =
        nextPermission === "granted" || nextPermission === "denied" ? nextPermission : "default";
      setPermission(normalized);
      if (normalized !== "granted") {
        if (normalized === "default") {
          setError("Permission was dismissed. You can try again when you are ready.");
        }
        return;
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
        setError("This browser could not create a push subscription.");
        return;
      }
      const result = await registerPushSubscriptionAction({
        endpoint: subscription.endpoint,
        p256dh: json.keys.p256dh,
        authKey: json.keys.auth,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setAccountEnabled(true);
      setDeviceSubscribed(result.deviceSubscribed !== false);
      if (typeof result.subscriptionCount === "number") {
        setSavedCount(result.subscriptionCount);
      }
      setMessage(result.message ?? "Push notifications are on for this browser.");
      router.refresh();
    } catch {
      setError("Could not enable push notifications on this browser.");
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      let endpoint: string | null = null;
      if (browserSupportsPush()) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        endpoint = subscription?.endpoint ?? null;
        await subscription?.unsubscribe();
      }
      const result = await disablePushNotificationsAction(endpoint);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAccountEnabled(false);
      setDeviceSubscribed(false);
      if (typeof result.subscriptionCount === "number") {
        setSavedCount(result.subscriptionCount);
      }
      setMessage(result.message ?? "Push notifications are off. In-app notifications stay on.");
      router.refresh();
    } catch {
      setError("Could not turn off push notifications.");
    } finally {
      setPending(false);
    }
  }

  const statusCopy: Record<typeof view.status, string> = {
    checking: "Checking this browser…",
    unconfigured: "Not available in this environment.",
    unsupported: "Not supported on this browser.",
    denied: "Blocked by browser.",
    off: "Off",
    on: "On",
    "other-device": "On for your account, not on this browser.",
  };

  return (
    <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
      <p>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">In-app: </span>
        On
      </p>
      <p>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">Push notifications: </span>
        {statusCopy[view.status]}
      </p>
      {view.status === "denied" ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Hui cannot ask again. Allow notifications for this site in your browser settings, then
          return here.
        </p>
      ) : null}
      {view.status === "off" || view.status === "on" || view.status === "other-device" ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Turning push off does not turn off in-app notifications.
        </p>
      ) : null}
      {savedCount > 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Saved on {savedCount} browser{savedCount === 1 ? "" : "s"}.
        </p>
      ) : null}
      {error ? (
        <p className="text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-emerald-700 dark:text-emerald-400" role="status">
          {message}
        </p>
      ) : null}
      {view.showEnable ? (
        <button type="button" className={buttonClassName} disabled={pending} onClick={() => void enable()}>
          {pending ? "Please wait…" : "Enable push notifications"}
        </button>
      ) : null}
      {view.showDisable ? (
        <button type="button" className={buttonClassName} disabled={pending} onClick={() => void disable()}>
          {pending ? "Please wait…" : "Disable push notifications"}
        </button>
      ) : null}
    </div>
  );
}
