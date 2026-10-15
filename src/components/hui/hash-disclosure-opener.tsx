"use client";

import { useEffect } from "react";

function openHashTarget(): boolean {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) {
    return false;
  }
  const target = document.getElementById(id);
  if (!target) {
    return false;
  }
  let node: HTMLDetailsElement | null = target.closest("details");
  while (node) {
    if (!node.open) {
      node.open = true;
    }
    node = node.parentElement?.closest("details") ?? null;
  }
  const disclosure =
    target instanceof HTMLDetailsElement ? target : target.closest("details");
  if (disclosure && !disclosure.open) {
    return false;
  }
  target.scrollIntoView({ block: "start" });
  return true;
}

/**
 * Deep links such as /events/:id#host (push notifications, attention cards) point inside
 * collapsed <details>. Open every ancestor disclosure for the hash target and bring it into view.
 * Retries while streamed or loading shells mount the target (e.g. /groups/:id#group-settings).
 */
export function HashDisclosureOpener() {
  useEffect(() => {
    function openFromHash() {
      openHashTarget();
    }

    openFromHash();

    const retryUntil = Date.now() + 8000;
    const retryTimer = window.setInterval(() => {
      if (openHashTarget() || Date.now() >= retryUntil) {
        window.clearInterval(retryTimer);
      }
    }, 100);

    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.clearInterval(retryTimer);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);

  return null;
}
