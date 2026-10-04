import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import {
  canProposeEvents,
  groupAllowsEventKind,
} from "@/domain/events/permissions";
import { listEventsForGroup } from "@/lib/events/queries";
import { eventKindLabel, eventStatusLabel } from "@/lib/events/labels";
import { getGroupDetail } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function GroupEventsPage({ params }: PageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [detail, events] = await Promise.all([
    getGroupDetail(supabase, groupId, user!.id),
    listEventsForGroup(supabase, groupId),
  ]);
  if (!detail) {
    notFound();
  }
  const canPropose =
    canProposeEvents(detail.viewerRole, detail.settings) &&
    (groupAllowsEventKind("one_off", detail.settings) ||
      groupAllowsEventKind("recurring", detail.settings));

  return (
    <AppShell title={`${detail.name} — Events`}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link href={`/groups/${groupId}`} className="underline-offset-4 hover:underline">
          Back to group
        </Link>
      </p>

      {canPropose ? (
        <p className="mt-6">
          <Link
            href={`/groups/${groupId}/events/new`}
            className="text-sm font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            Propose new event
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Event proposals are not available for your role or this group&apos;s settings.
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Events</h2>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No events yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {events.map((event) => (
              <li key={event.id} className="px-4 py-3 text-sm">
                <Link
                  href={`/events/${event.id}`}
                  className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
                >
                  {event.title}
                </Link>
                <p className="mt-1 text-xs text-zinc-500">
                  {eventStatusLabel(event.status)} · {eventKindLabel(event.kind)} ·{" "}
                  {event.creatorDisplayName}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
