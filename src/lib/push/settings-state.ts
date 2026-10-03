export type PushSettingsStatus =
  | "checking"
  | "unconfigured"
  | "unsupported"
  | "denied"
  | "off"
  | "on"
  | "other-device";

export type PushSettingsView = {
  status: PushSettingsStatus;
  showEnable: boolean;
  showDisable: boolean;
};

export function resolvePushSettingsView(input: {
  configured: boolean;
  supported: boolean | null;
  permission: "default" | "granted" | "denied";
  webPushEnabled: boolean;
  deviceSubscribed: boolean;
}): PushSettingsView {
  if (!input.configured) {
    return { status: "unconfigured", showEnable: false, showDisable: false };
  }
  if (input.supported === null) {
    return { status: "checking", showEnable: false, showDisable: false };
  }
  if (!input.supported) {
    return {
      status: "unsupported",
      showEnable: false,
      showDisable: input.webPushEnabled,
    };
  }
  if (input.permission === "denied") {
    return {
      status: "denied",
      showEnable: false,
      showDisable: input.webPushEnabled,
    };
  }
  if (input.webPushEnabled && input.deviceSubscribed) {
    return { status: "on", showEnable: false, showDisable: true };
  }
  if (input.webPushEnabled) {
    return { status: "other-device", showEnable: true, showDisable: true };
  }
  return { status: "off", showEnable: true, showDisable: false };
}
