"use client";

import { useSyncExternalStore } from "react";

const DISMISSED_KEY = "hui:push-onboard-dismissed-at";

let dismissedAt: number | null = null;
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
    // Private mode: card may reappear next visit.
  }
}

function recompute() {
  dismissedAt = readDismissedAt();
  for (const listener of listeners) {
    listener();
  }
}

export function startPushOnboardTracking() {
  if (started || typeof window === "undefined") {
    return;
  }
  started = true;
  recompute();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePushOnboardDismissedAt(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => dismissedAt,
    () => null,
  );
}

export function dismissPushOnboardCard() {
  writeDismissedAt(Date.now());
  recompute();
}
