"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { readPushDeviceStateAction } from "@/app/notifications/push-actions";
import { HuiSurface } from "@/components/hui/hui-surface";
import { huiButtonClass } from "@/components/hui/hui-button";
import { shouldShowPushOnboardCard } from "@/domain/push/onboarding";
import { browserSupportsWebPush, enableWebPushNotifications } from "@/lib/push/client-enable";
import {
  dismissPushOnboardCard,
  startPushOnboardTracking,
  usePushOnboardDismissedAt,
} from "@/lib/push/onboard-store";
import { useInstallSnapshot } from "@/lib/pwa/install-store";

type PushNotificationsOnboardCardProps = {
  pushConfigured: boolean;
  vapidPublicKey: string | null;
};

export function PushNotificationsOnboardCard({
  pushConfigured,
  vapidPublicKey,
}: PushNotificationsOnboardCardProps) {
  const router = useRouter();
  const install = useInstallSnapshot();
  const dismissedAt = usePushOnboardDismissedAt();
  const [permission, setPermission] = useState<"default" | "granted" | "denied">("default");
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [webPushEnabled, setWebPushEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startPushOnboardTracking();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!pushConfigured || !vapidPublicKey || !browserSupportsWebPush()) {
        if (!cancelled) {
          setReady(true);
        }
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
        setWebPushEnabled(state.webPushEnabled === true);
      } catch {
        if (!cancelled) {
          setDeviceSubscribed(false);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pushConfigured, vapidPublicKey]);

  const installed = install.ready && install.availability === "installed";

  const mode =
    ready && install.ready
      ? shouldShowPushOnboardCard({
          installed,
          permission,
          dismissedAt,
          now: install.now,
          configured: pushConfigured,
          supported: browserSupportsWebPush(),
          deviceSubscribed,
          webPushEnabled,
        })
      : false;

  if (!mode || !vapidPublicKey) {
    return null;
  }

  async function enable() {
    setPending(true);
    setError(null);
    try {
      const result = await enableWebPushNotifications(vapidPublicKey!);
      setPermission(result.permission);
      if (!result.ok) {
        if (result.error) {
          setError(result.error);
        }
        return;
      }
      setWebPushEnabled(true);
      setDeviceSubscribed(result.deviceSubscribed);
      dismissPushOnboardCard();
      router.refresh();
    } catch {
      setError("Could not enable push notifications on this browser.");
    } finally {
      setPending(false);
    }
  }

  return (
    <HuiSurface tone="clay" shape="organic" padding="md" className="hui-rise mb-6">
      <section aria-label="Notification settings" className="space-y-3">
        <h2 className="text-base font-extrabold text-foreground">Stay in the loop</h2>
        {mode === "enable-prompt" ? (
          <>
            <p className="hui-type-supporting">
              Turn on notifications to hear when someone responds, proposes a time, confirms the hui,
              or when you&apos;re asked to host — without checking the app constantly.
            </p>
            {error ? (
              <p className="hui-message-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={huiButtonClass({ variant: "primary", size: "sm" })}
                disabled={pending}
                onClick={() => void enable()}
              >
                {pending ? "Please wait…" : "Enable notifications"}
              </button>
              <button
                type="button"
                className={huiButtonClass({ variant: "ghost", size: "sm" })}
                onClick={dismissPushOnboardCard}
              >
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="hui-type-supporting">
              Notifications are blocked in your browser. Allow them in system or browser settings,
              then finish setup in Hui.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/profile/notifications" className={huiButtonClass({ variant: "primary", size: "sm" })}>
                Open notification settings
              </Link>
              <button
                type="button"
                className={huiButtonClass({ variant: "ghost", size: "sm" })}
                onClick={dismissPushOnboardCard}
              >
                Dismiss
              </button>
            </div>
          </>
        )}
      </section>
    </HuiSurface>
  );
}
