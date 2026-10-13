/// <reference lib="esnext" />
/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

import { openNotificationDestination } from "../lib/push/notification-click";
import { notificationClickPath, pushEventDisplay } from "../lib/push/payload";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const networkOnly = new NetworkOnly();

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.hostname.endsWith(".supabase.co"),
      handler: networkOnly,
    },
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: networkOnly,
    },
    {
      matcher: () => true,
      handler: networkOnly,
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.mode === "navigate";
        },
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener("push", (event) => {
  let raw: unknown = null;
  try {
    raw = event.data?.json();
  } catch {
    raw = null;
  }
  const display = pushEventDisplay(raw);
  event.waitUntil(self.registration.showNotification(display.title, display.options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | undefined;
  const path = notificationClickPath(data?.url);
  event.waitUntil(openNotificationDestination(self.clients, self.location.origin, path));
});
