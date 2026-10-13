"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isValidPushEndpoint, isValidPushKey } from "@/lib/push/subscription";
import { createClient } from "@/lib/supabase/server";

export type PushActionState = {
  error?: string;
  message?: string;
  webPushEnabled?: boolean;
  deviceSubscribed?: boolean;
  subscriptionCount?: number;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }
  return { supabase, user };
}

function mapState(row: {
  web_push_enabled: boolean;
  device_subscribed: boolean;
  subscription_count: number;
}): Pick<PushActionState, "webPushEnabled" | "deviceSubscribed" | "subscriptionCount"> {
  return {
    webPushEnabled: row.web_push_enabled,
    deviceSubscribed: row.device_subscribed,
    subscriptionCount: row.subscription_count,
  };
}

export async function readPushDeviceStateAction(
  endpoint: string | null,
): Promise<PushActionState> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("my_push_subscription_state", {
    p_endpoint: endpoint && isValidPushEndpoint(endpoint) ? endpoint : "",
  });
  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return { error: "Could not read push notification settings." };
  }
  return mapState(data[0] as {
    web_push_enabled: boolean;
    device_subscribed: boolean;
    subscription_count: number;
  });
}

export async function registerPushSubscriptionAction(input: {
  endpoint: string;
  p256dh: string;
  authKey: string;
}): Promise<PushActionState> {
  if (!isValidPushEndpoint(input.endpoint) || !isValidPushKey(input.p256dh) || !isValidPushKey(input.authKey)) {
    return { error: "This browser could not be registered for push." };
  }

  const { supabase, user } = await requireUser();
  const headerStore = await headers();
  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth_key: input.authKey,
    p_user_agent: headerStore.get("user-agent"),
  });
  if (error) {
    return { error: "This browser could not be registered for push." };
  }

  const { error: preferenceError } = await supabase
    .from("profiles")
    .update({ web_push_enabled: true })
    .eq("id", user.id);
  if (preferenceError) {
    return { error: "Could not turn on push notifications." };
  }

  revalidatePath("/profile");
  const state = await readPushDeviceStateAction(input.endpoint);
  return { message: "Push notifications are on for this browser.", ...state };
}

export async function disablePushNotificationsAction(
  endpoint: string | null,
): Promise<PushActionState> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ web_push_enabled: false })
    .eq("id", user.id);
  if (error) {
    return { error: "Could not turn off push notifications." };
  }

  if (endpoint && isValidPushEndpoint(endpoint)) {
    await supabase.rpc("remove_push_subscription", { p_endpoint: endpoint });
  }

  revalidatePath("/profile");
  const state = await readPushDeviceStateAction(endpoint);
  return {
    message: "Push notifications are off. In-app notifications stay on.",
    ...state,
    webPushEnabled: false,
  };
}
