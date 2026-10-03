import "server-only";

import { after } from "next/server";

export function schedulePushDelivery(): void {
  after(() => deliverPushOutboxSafely());
}

export async function deliverPushOutboxSafely(): Promise<void> {
  try {
    const { drainPushOutbox } = await import("./drain");
    await drainPushOutbox();
  } catch {
    console.error("Web Push drain failed.");
  }
}
