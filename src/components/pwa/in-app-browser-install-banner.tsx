"use client";

import { useState } from "react";

import { huiButtonClass } from "@/components/hui/hui-button";
import { inAppBrowserInstallBanner, type InstallPlatform } from "@/domain/pwa/install";

export function InAppBrowserInstallBanner({ platform }: { platform: InstallPlatform }) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const banner = inAppBrowserInstallBanner(platform);

  async function copyPageLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("Link copied.");
    } catch {
      setCopyMessage("Could not copy. Select the address bar and copy the link manually.");
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
