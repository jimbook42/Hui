import { describe, expect, it } from "vitest";

import { resolvePushSettingsView } from "./settings-state";

const ready = {
  configured: true,
  supported: true,
  permission: "default" as const,
  webPushEnabled: false,
  deviceSubscribed: false,
};

describe("push settings view", () => {
  it("keeps push off until the member enables it", () => {
    expect(resolvePushSettingsView(ready)).toMatchObject({
      status: "off",
      showEnable: true,
      showDisable: false,
    });
  });

  it("shows push on for this browser without hiding in-app as a separate channel", () => {
    expect(
      resolvePushSettingsView({
        ...ready,
        permission: "granted",
        webPushEnabled: true,
        deviceSubscribed: true,
      }),
    ).toMatchObject({ status: "on", showEnable: false, showDisable: true });
  });

  it("does not offer enable when the browser is unsupported or permission is blocked", () => {
    expect(resolvePushSettingsView({ ...ready, supported: false }).status).toBe("unsupported");
    expect(resolvePushSettingsView({ ...ready, supported: false }).showEnable).toBe(false);
    expect(resolvePushSettingsView({ ...ready, permission: "denied" })).toMatchObject({
      status: "denied",
      showEnable: false,
    });
  });

  it("hides the enable flow when the server is not configured", () => {
    expect(resolvePushSettingsView({ ...ready, configured: false })).toMatchObject({
      status: "unconfigured",
      showEnable: false,
      showDisable: false,
    });
  });
});
