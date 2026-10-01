"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

export function HuiSerwistProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      cacheOnNavigation={false}
      reloadOnOnline={true}
    >
      {children}
    </SerwistProvider>
  );
}
