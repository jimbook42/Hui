import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import {
  EventDetailHeavyFallback,
  EventDetailHeavySections,
} from "@/components/events/event-detail-heavy-sections";
import { formatEventTimeRange } from "@/domain/datetime/timezone";
import { getEventDetail } from "@/lib/events/queries";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { devTimed } from "@/lib/perf/dev-server-timing";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

function formatWhen(
  startsAt: string | null,
  endsAt: string | null,
  timeZone: string,
): string {
  if (!startsAt) {
    return "Not set";
  }
  if (endsAt) {
    return formatEventTimeRange(startsAt, endsAt, timeZone);
  }
  return formatEventTimeRange(startsAt, startsAt, timeZone);
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params;
  const user = await devTimed("event-page:getUser", () => getServerAuthUser());
  const supabase = await getServerSupabase();

  const detail = await devTimed("event-page:event-detail", () =>
    getEventDetail(supabase, eventId, user!.id),
  );
  if (!detail) {
    notFound();
  }

  return (
    <AppShell title={detail.title}>
      <p className="hui-type-supporting">
        <Link
          href={`/groups/${detail.groupId}`}
          className="underline-offset-4 hover:underline"
        >
          {detail.groupName}
        </Link>
        {" · "}
        <Link
          href={`/groups/${detail.groupId}/events`}
          className="underline-offset-4 hover:underline"
        >
          Events
        </Link>
      </p>

      <Suspense fallback={<EventDetailHeavyFallback />}>
        <EventDetailHeavySections
          detail={detail}
          userId={user!.id}
          formatWhen={formatWhen}
        />
      </Suspense>
    </AppShell>
  );
}
