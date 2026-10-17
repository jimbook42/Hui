"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { readPushDeviceStateAction } from "@/app/notifications/push-actions";
import { shouldShowPushOnboardCard } from "@/domain/push/onboarding";
import { shouldShowInstallCard } from "@/domain/pwa/install";
import { isOnboardingAppPath, pickSignedInNudge } from "@/domain/pwa/signed-in-nudges";
import { browserSupportsWebPush } from "@/lib/push/client-enable";
import {
  startPushOnboardTracking,
  usePushOnboardDismissedAt,
} from "@/lib/push/onboard-store";
import { useInstallSnapshot } from "@/lib/pwa/install-store";

import { InstallHuiCard } from "./install-hui";
import { PushNotificationsOnboardCard } from "./push-notifications-onboard";

type SignedInEngagementNudgesProps = {
  pushConfigured: boolean;
  vapidPublicKey: string | null;
};

export function SignedInEngagementNudges({
  pushConfigured,
  vapidPublicKey,
}: SignedInEngagementNudgesProps) {
  const pathname = usePathname();
  const router = useRouter();
  const install = useInstallSnapshot();
  const dismissedAt = usePushOnboardDismissedAt();
  const [permission, setPermission] = useState<"default" | "granted" | "denied">("default");
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [webPushEnabled, setWebPushEnabled] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [pushReady, setPushReady] = useState(false);

  useEffect(() => {
    startPushOnboardTracking();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!pushConfigured || !vapidPublicKey || !browserSupportsWebPush()) {
        if (!cancelled) {
          setPushReady(true);
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
        setSubscriptionCount(state.subscriptionCount ?? 0);
      } catch {
        if (!cancelled) {
          setDeviceSubscribed(false);
        }
      } finally {
        if (!cancelled) {
          setPushReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pushConfigured, vapidPublicKey]);

  if (isOnboardingAppPath(pathname)) {
    return null;
  }

  if (!install.ready) {
    return null;
  }

  const installEligible = shouldShowInstallCard({
    availability: install.availability,
    platform: install.platform,
    dismissedAt: install.dismissedAt,
    now: install.now,
    visitCount: install.visitCount,
  });

  const installed = install.availability === "installed";

  const notificationMode =
    pushReady && vapidPublicKey
      ? shouldShowPushOnboardCard({
          installed,
          permission,
          dismissedAt,
          now: install.now,
          configured: pushConfigured,
          supported: browserSupportsWebPush(),
          deviceSubscribed,
          webPushEnabled,
          subscriptionCount,
          requireInstalled: false,
        })
      : false;

  const notificationEligible = notificationMode === "enable-prompt";

  const active = pickSignedInNudge({ installEligible, notificationEligible });

  if (active === "install") {
    return <InstallHuiCard />;
  }

  if (active === "notification") {
    return (
      <PushNotificationsOnboardCard
        pushConfigured={pushConfigured}
        vapidPublicKey={vapidPublicKey}
        requireInstalled={false}
        managedVisibility
        onEnabled={() => router.refresh()}
      />
    );
  }

  return null;
}
