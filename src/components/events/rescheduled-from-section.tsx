import { RescheduledFromNote } from "@/components/events/rescheduled-from-note";
import { getLatestRescheduleFrom } from "@/lib/events/reschedule-audit";
import { getServerSupabase } from "@/lib/auth/server-session";
import type { EventDetail } from "@/lib/events/types";
import { loadEventPage } from "@/lib/events/event-page-data";

type Props = { detail: EventDetail; userId: string };

export async function RescheduledFromSection({ detail, userId }: Props) {
  if (detail.status === "cancelled" || detail.status === "completed") {
    return null;
  }

  const supabase = await getServerSupabase();
  const from = await getLatestRescheduleFrom(supabase, detail.id);
  if (!from) {
    return null;
  }

  const data = await loadEventPage(detail, userId);
  return <RescheduledFromNote from={from} timeZone={data.displayTimeZone} />;
}
