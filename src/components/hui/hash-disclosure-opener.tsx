"use client";

import { useEffect } from "react";

/**
 * Deep links such as /events/:id#host (push notifications, attention cards) point inside
 * collapsed <details>. Open every ancestor disclosure for the hash target and bring it into view.
 */
export function HashDisclosureOpener() {
  useEffect(() => {
    function openFromHash() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) {
        return;
      }
      const target = document.getElementById(id);
      if (!target) {
        return;
      }
      let opened = false;
      let node: HTMLDetailsElement | null = target.closest("details");
      while (node) {
        if (!node.open) {
          node.open = true;
          opened = true;
        }
        node = node.parentElement?.closest("details") ?? null;
      }
      if (opened) {
        target.scrollIntoView({ block: "start" });
      }
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return null;
}
