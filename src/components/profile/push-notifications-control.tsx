"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  disablePushNotificationsAction,
  readPushDeviceStateAction,
} from "@/app/notifications/push-actions";
import { enableWebPushNotifications, browserSupportsWebPush } from "@/lib/push/client-enable";
import { resolvePushSettingsView } from "@/lib/push/settings-state";

type PushNotificationsControlProps = {
  configured: boolean;
  vapidPublicKey: string | null;
  webPushEnabled: boolean;
  subscriptionCount: number;
};

const buttonClassName =
  "hui-btn hui-btn-secondary rounded-full hui-focus-ring";

function browserSupportsPush(): boolean {
  return browserSupportsWebPush();
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
      const result = await enableWebPushNotifications(vapidPublicKey);
      setPermission(result.permission);
      if (!result.ok) {
        if (result.error) {
          setError(result.error);
        }
        return;
      }
      setAccountEnabled(true);
      setDeviceSubscribed(result.deviceSubscribed);
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
    <div className="space-y-4 text-sm text-foreground">
      <p>
        <span className="font-medium text-foreground">In-app: </span>
        On
      </p>
      <p>
        <span className="font-medium text-foreground">Push notifications: </span>
        {statusCopy[view.status]}
      </p>
      {view.status === "denied" ? (
        <p className="text-muted-foreground">
          Hui cannot ask again. Allow notifications for this site in your browser settings, then
          return here.
        </p>
      ) : null}
      {view.status === "off" || view.status === "on" || view.status === "other-device" ? (
        <p className="text-muted-foreground">
          Turning push off does not turn off in-app notifications.
        </p>
      ) : null}
      {savedCount > 0 ? (
        <p className="text-muted-foreground">
          Saved on {savedCount} browser{savedCount === 1 ? "" : "s"}.
        </p>
      ) : null}
      {error ? (
        <p className="hui-message-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="hui-message-success" role="status">
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
