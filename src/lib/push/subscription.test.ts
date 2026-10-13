import { describe, expect, it } from "vitest";

import { urlBase64ToUint8Array } from "./browser";
import { isPushDrainAuthorized, isValidPushEndpoint, isValidPushKey } from "./subscription";
import { readVapidConfig } from "./vapid-env";

describe("push subscription input", () => {
  it("accepts an https endpoint and base64url keys", () => {
    expect(isValidPushEndpoint("https://push.example.test/subscriptions/device-1")).toBe(true);
    expect(isValidPushEndpoint("http://push.example.test/subscriptions/device-1")).toBe(false);
    expect(isValidPushKey("B".repeat(40))).toBe(true);
    expect(isValidPushKey("short")).toBe(false);
  });

  it("authorizes the drain route only with the server secret", () => {
    expect(isPushDrainAuthorized("Bearer test-secret", { PUSH_DELIVERY_SECRET: "test-secret" })).toBe(
      true,
    );
    expect(isPushDrainAuthorized("Bearer other", { CRON_SECRET: "test-secret" })).toBe(false);
    expect(isPushDrainAuthorized("Bearer test-secret", {})).toBe(false);
  });

  it("requires a complete VAPID config and does not invent one", () => {
    expect(
      readVapidConfig({
        VAPID_PUBLIC_KEY: "public",
        VAPID_PRIVATE_KEY: "private",
        VAPID_SUBJECT: "mailto:hui@example.com",
      })?.publicKey,
    ).toBe("public");
    expect(readVapidConfig({ VAPID_PUBLIC_KEY: "public" })).toBeNull();
    expect(
      readVapidConfig({
        VAPID_PUBLIC_KEY: "public",
        VAPID_PRIVATE_KEY: "private",
        VAPID_SUBJECT: "not-a-contact",
      }),
    ).toBeNull();
  });

  it("decodes a URL-safe VAPID public key", () => {
    const bytes = urlBase64ToUint8Array("AQIDBA");
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });
});
