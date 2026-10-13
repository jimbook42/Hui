import { planPushDelivery, type PushPayload } from "./payload";

export type PushSubscriptionTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  authKey: string;
};

export type PushSender = (
  subscription: PushSubscriptionTarget,
  payload: PushPayload,
) => Promise<void>;

export type PushDeliveryStatus = "sent" | "skipped" | "failed";

export type PushDeliveryResult = {
  status: PushDeliveryStatus;
  removeSubscriptionIds: string[];
  detail: string;
};

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error === "object" && error && "statusCode" in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    if (typeof code === "number") {
      return code;
    }
  }
  return undefined;
}

export function isStalePushStatus(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

export async function deliverToSubscriptions(input: {
  payload: PushPayload | null;
  skipReason?: string;
  subscriptions: PushSubscriptionTarget[];
  sender: PushSender;
}): Promise<PushDeliveryResult> {
  if (!input.payload) {
    return {
      status: "skipped",
      removeSubscriptionIds: [],
      detail: input.skipReason ?? "not eligible",
    };
  }
  if (input.subscriptions.length === 0) {
    return {
      status: "skipped",
      removeSubscriptionIds: [],
      detail: "no subscriptions",
    };
  }

  let sent = 0;
  let transientFailures = 0;
  const removeSubscriptionIds: string[] = [];

  for (const subscription of input.subscriptions) {
    try {
      await input.sender(subscription, input.payload);
      sent += 1;
    } catch (error) {
      const statusCode = statusCodeOf(error);
      if (isStalePushStatus(statusCode)) {
        removeSubscriptionIds.push(subscription.id);
      } else {
        transientFailures += 1;
      }
    }
  }

  if (sent > 0) {
    return {
      status: "sent",
      removeSubscriptionIds,
      detail: `sent ${sent}; failed ${transientFailures}; removed ${removeSubscriptionIds.length}`,
    };
  }
  if (removeSubscriptionIds.length === input.subscriptions.length) {
    return {
      status: "skipped",
      removeSubscriptionIds,
      detail: "removed stale subscriptions",
    };
  }
  return {
    status: "failed",
    removeSubscriptionIds,
    detail: `transient failures ${transientFailures}`,
  };
}

export async function deliverNotificationPush(input: {
  id: string;
  kind: string;
  title: string;
  body: string;
  eventId: string | null;
  groupId: string;
  webPushEnabled: boolean;
  createdAt: string;
  now?: Date;
  subscriptions: PushSubscriptionTarget[];
  sender: PushSender;
}): Promise<PushDeliveryResult> {
  const plan = planPushDelivery(input);
  return deliverToSubscriptions({
    payload: plan.payload,
    skipReason: plan.reason,
    subscriptions: input.subscriptions,
    sender: input.sender,
  });
}
