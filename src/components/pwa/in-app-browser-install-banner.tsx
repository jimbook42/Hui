"use client";

import { useState } from "react";

import { huiButtonClass } from "@/components/hui/hui-button";
import {
  inAppBrowserInstallBanner,
  type InAppBrowserInstallBanner as InAppBrowserBannerCopy,
  type InstallPlatform,
} from "@/domain/pwa/install";

export function InAppBrowserInstallBanner({
  platform,
  banner: bannerOverride,
}: {
  platform: InstallPlatform;
  banner?: InAppBrowserBannerCopy;
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const banner = bannerOverride ?? inAppBrowserInstallBanner(platform);

  async function copyPageLink() {
    const url = window.location.href;
    const pastedInto = platform === "ios" ? "Safari" : "Chrome";
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyMessage(`Link copied — paste it into ${pastedInto}`);
      window.setTimeout(() => setCopyMessage(null), 3000);
    } catch {
      setCopyMessage("Could not copy. Select the address bar and copy the link manually.");
      window.setTimeout(() => setCopyMessage(null), 3000);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-sm font-bold text-foreground">{banner.title}</p>
      <ol className="hui-type-supporting list-decimal space-y-1 pl-5">
        {banner.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <button type="button" className={huiButtonClass({ variant: "secondary", size: "sm" })} onClick={() => void copyPageLink()}>
        Copy link
      </button>
      {copyMessage ? (
        <p className="hui-type-supporting" role="status">
          {copyMessage}
        </p>
      ) : null}
    </div>
  );
}
