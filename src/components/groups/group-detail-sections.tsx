import Link from "next/link";

import { EventCard } from "@/components/hui/event-card";
import { SectionHeader } from "@/components/hui/section-header";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { loadHomeData, splitHomeEvents } from "@/lib/events/home-data";

/** Upcoming gatherings for one group, streamed under the hero. */
export async function GroupUpcoming({ groupId }: { groupId: string }) {
  const user = await getServerAuthUser();
  const supabase = await getServerSupabase();
  const { events } = await loadHomeData(supabase, user!.id, { groupId });
  const sections = splitHomeEvents(events);
  const live = [...sections.attention, ...sections.upcoming, ...sections.planning].slice(0, 3);

  return (
    <section aria-labelledby="group-upcoming" className="hui-rise-2 space-y-4">
      <SectionHeader
        id="group-upcoming"
        title="Coming up"
        action={
          <Link
            href={`/groups/${groupId}/events`}
            className="hui-link hui-focus-ring inline-flex min-h-11 items-center rounded-full px-2 text-sm"
          >
            All events
          </Link>
        }
      />
      {live.length === 0 ? (
        <p className="rounded-hui-xl bg-surface px-5 py-5 text-sm font-semibold text-muted-foreground hui-shadow-sm">
          Nothing is planned with this group yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {live.map((event, index) => (
            <li key={event.id}>
              <EventCard event={event} variant={index === 0 ? "featured" : "standard"} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function GroupUpcomingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading upcoming gatherings">
      <div className="hui-skeleton h-6 w-32 !rounded-full" />
      <div className="hui-skeleton h-44 !rounded-hui-xl" />
    </div>
  );
}
