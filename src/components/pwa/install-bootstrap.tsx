"use client";

import { useEffect } from "react";

import { startInstallTracking } from "@/lib/pwa/install-store";

/** Starts listening for install events as early as possible. Renders nothing. */
export function InstallBootstrap() {
  useEffect(() => {
    startInstallTracking();
  }, []);
  return null;
}
