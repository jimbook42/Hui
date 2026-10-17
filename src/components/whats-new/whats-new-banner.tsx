"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

import {
  resolveWhatsNew,
  WHATS_NEW_STORAGE_KEY,
} from "@/domain/whats-new/resolve";
import { whatsNewForVersion } from "@/domain/whats-new/releases";

function readLastSeenVersion(): string | null {
  try {
    const raw = window.localStorage.getItem(WHATS_NEW_STORAGE_KEY);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

function writeLastSeenVersion(version: string) {
  try {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, version);
  } catch {
    // ignore quota / private mode
  }
}

function subscribeToWhatsNew(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === WHATS_NEW_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

type WhatsNewBannerProps = {
  currentVersion: string;
};

export function WhatsNewBanner({ currentVersion }: WhatsNewBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const markedNewUserRef = useRef(false);

  const readVisibleVersion = useCallback(() => {
    if (dismissed) {
      return null;
    }
    const lastSeen = readLastSeenVersion();
    const resolved = resolveWhatsNew({ currentVersion, lastSeenVersion: lastSeen });
    if (resolved.action === "mark_seen_without_show") {
      if (!markedNewUserRef.current) {
        markedNewUserRef.current = true;
        writeLastSeenVersion(resolved.version);
      }
      return null;
    }
    if (resolved.action === "show") {
      return resolved.version;
    }
    return null;
  }, [currentVersion, dismissed]);

  const visibleVersion = useSyncExternalStore(
    subscribeToWhatsNew,
    readVisibleVersion,
    () => null,
  );

  if (!visibleVersion) {
    return null;
  }

  const release = whatsNewForVersion(visibleVersion);
  if (!release) {
    return null;
  }

  const versionToDismiss = visibleVersion;

  function dismiss() {
    writeLastSeenVersion(versionToDismiss);
    setDismissed(true);
  }

  return (
    <div
      className="mb-5 rounded-hui-lg border border-border bg-surface px-4 py-4 hui-shadow-sm"
      role="region"
      aria-label="What's new"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-foreground">{release.title}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {release.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="hui-focus-ring shrink-0 rounded-full px-3 py-1.5 text-sm font-bold text-muted-foreground hover:bg-muted"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
