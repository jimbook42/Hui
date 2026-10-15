"use client";

import { useState } from "react";

import {
  detectInAppBrowser,
  detectInstallPlatform,
  inAppBrowserOAuthSignInBanner,
  type InstallPlatform,
} from "@/domain/pwa/install";

import { InAppBrowserInstallBanner } from "@/components/pwa/in-app-browser-install-banner";

type InAppBrowserAuthBannerProps = {
  className?: string;
};

function readInAppAuthSnapshot(): { inApp: boolean; platform: InstallPlatform } | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  const platform = detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
  if (!detectInAppBrowser(navigator.userAgent)) {
    return null;
  }
  return { inApp: true, platform };
}

/**
 * Shown on public auth surfaces when the visitor is in a social/messenger in-app browser.
 */
export function InAppBrowserAuthBanner({ className }: InAppBrowserAuthBannerProps) {
  const [snapshot] = useState(readInAppAuthSnapshot);

  if (!snapshot) {
    return null;
  }

  const { platform } = snapshot;

  const banner = inAppBrowserOAuthSignInBanner(platform);

  return (
    <div className={className}>
      <InAppBrowserInstallBanner platform={platform} banner={banner} />
    </div>
  );
}
