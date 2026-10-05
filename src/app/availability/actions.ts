"use server";

import { revalidatePath } from "next/cache";

import {
  parseHhmmToMinutes,
  type StandingAvailabilityKind,
} from "@/domain/scheduling/standing-availability";
import { getGroupDetail } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type StandingAvailabilityActionState = {
  error?: string;
  message?: string;
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

function parseKind(value: string): StandingAvailabilityKind | null {
  if (value === "usually_available" || value === "usually_unavailable") {
    return value;
  }
  return null;
}

function parseDayOfWeek(value: string): number | null {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    return null;
  }
  return day;
}

export async function addStandingAvailabilityWindowAction(
  _prev: StandingAvailabilityActionState,
  formData: FormData,
): Promise<StandingAvailabilityActionState> {
  const groupId = String(formData.get("group_id") ?? "");
  const kind = parseKind(String(formData.get("kind") ?? ""));
  const dayOfWeek = parseDayOfWeek(String(formData.get("day_of_week") ?? ""));
  const allDay = String(formData.get("all_day") ?? "") === "on";

  if (!groupId || kind === null || dayOfWeek === null) {
    return { error: "Choose a day and availability type." };
  }

  let startMinute = 0;
  let endMinute = 1440;
  if (!allDay) {
    const start = parseHhmmToMinutes(String(formData.get("start_time") ?? ""));
    const end = parseHhmmToMinutes(String(formData.get("end_time") ?? ""));
    if (start === null || end === null) {
      return { error: "Enter valid start and end times, or choose all day." };
    }
    if (end <= start) {
      return { error: "End time must be after start time." };
    }
    startMinute = start;
    endMinute = end;
  }

  const { supabase, user } = await requireUser();
  const detail = await getGroupDetail(supabase, groupId, user.id);
  if (!detail) {
    return { error: "Group not found." };
  }

  const { error } = await supabase.from("group_member_standing_availability").insert({
    group_id: groupId,
    user_id: user.id,
    day_of_week: dayOfWeek,
    start_minute: startMinute,
    end_minute: endMinute,
    kind,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile/availability");
  revalidatePath(`/groups/${groupId}`);
  return { message: "Usual availability saved." };
}

export async function deleteStandingAvailabilityWindowAction(
  _prev: StandingAvailabilityActionState,
  formData: FormData,
): Promise<StandingAvailabilityActionState> {
  const windowId = String(formData.get("window_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  if (!windowId || !groupId) {
    return { error: "Missing window." };
  }

  const { supabase, user } = await requireUser();
  const { error, count } = await supabase
    .from("group_member_standing_availability")
    .delete({ count: "exact" })
    .eq("id", windowId)
    .eq("user_id", user.id)
    .eq("group_id", groupId);

  if (error) {
    return { error: error.message };
  }
  if ((count ?? 0) === 0) {
    return { error: "Could not remove that window." };
  }

  revalidatePath("/profile/availability");
  revalidatePath(`/groups/${groupId}`);
  return { message: "Removed." };
}
