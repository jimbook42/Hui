"use client";

import { useSyncExternalStore } from "react";

import {
  detectInstallPlatform,
  resolveInstallAvailability,
  type InstallAvailability,
  type InstallPlatform,
} from "@/domain/pwa/install";

/**
 * Browser-side install state. `beforeinstallprompt` fires once, early, and cannot be replayed, so
 * it is captured here (started from a bootstrap component in the root layout) and shared with
 * whichever component wants to offer installation.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type InstallSnapshot = {
  /** False until the browser facts are read (server render and first client render). */
  ready: boolean;
  platform: InstallPlatform;
  availability: InstallAvailability;
  dismissedAt: number | null;
  /** When this snapshot was taken (components must not read the clock while rendering). */
  now: number;
};

const DISMISSED_KEY = "hui:install-dismissed-at";

const SERVER_SNAPSHOT: InstallSnapshot = {
  ready: false,
  platform: "other",
  availability: "unsupported",
  dismissedAt: null,
  now: 0,
};

let snapshot: InstallSnapshot = SERVER_SNAPSHOT;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<() => void>();

function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeDismissedAt(value: number) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(value));
  } catch {
    // Private mode: the card simply comes back next visit.
  }
}

function isStandalone(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function recompute() {
  const platform = detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints);
  snapshot = {
    ready: true,
    platform,
    availability: resolveInstallAvailability({
      installed,
      hasNativePrompt: deferredPrompt !== null,
      platform,
    }),
    dismissedAt: readDismissedAt(),
    now: Date.now(),
  };
  for (const listener of listeners) {
    listener();
  }
}

/** Idempotent. Call once from a client effect. */
export function startInstallTracking() {
  if (started || typeof window === "undefined") {
    return;
  }
  started = true;
  installed = isStandalone();

  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep the event for our own button instead of letting the browser show its mini-infobar.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    recompute();
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    recompute();
  });

  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", (event) => {
    installed = event.matches || isStandalone();
    recompute();
  });

  recompute();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInstallSnapshot(): InstallSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  );
}

/** "Not now": hides the dashboard card for the cool-down period. */
export function dismissInstallCard() {
  writeDismissedAt(Date.now());
  recompute();
}

export type InstallPromptOutcome = "accepted" | "dismissed" | "unavailable";

/** Triggers the native prompt. A dismissal also starts the cool-down so we never nag. */
export async function promptInstall(): Promise<InstallPromptOutcome> {
  const event = deferredPrompt;
  if (!event) {
    return "unavailable";
  }
  // The browser only lets a prompt event be used once.
  deferredPrompt = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      installed = true;
      recompute();
      return "accepted";
    }
    writeDismissedAt(Date.now());
    recompute();
    return "dismissed";
  } catch {
    recompute();
    return "unavailable";
  }
}
