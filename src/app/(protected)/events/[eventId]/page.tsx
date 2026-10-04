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

  const displayTimeZone = detail.timezone ?? "Pacific/Auckland";

  return (
    <AppShell title={detail.title}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
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

      {detail.status === "confirmed" ? (
        <div
          className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          <p className="font-medium">Confirmed</p>
          <p className="mt-1">
            {formatWhen(detail.startsAt, detail.endsAt, displayTimeZone)}
          </p>
        </div>
      ) : null}
      {detail.status === "cancelled" ? (
        <div
          className="mt-6 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
          role="status"
        >
          This event was cancelled. Scheduling and confirmation are closed.
        </div>
      ) : null}

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
