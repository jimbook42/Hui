import Link from "next/link";

import { EventCard, EventCardSkeleton } from "@/components/hui/event-card";
import { EmptyState } from "@/components/hui/empty-state";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { ChevronRightIcon, PlusIcon } from "@/components/hui/icons";
import { SectionHeader } from "@/components/hui/section-header";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import {
  createHuiHref,
  loadHomeData,
  splitHomeEvents,
  type HomeEvent,
} from "@/lib/events/home-data";
import { devTimed } from "@/lib/perf/dev-server-timing";
import { cn } from "@/lib/ui/cn";

const CARD_TONES = ["primary", "secondary", "sage"] as const;

function toneFor(index: number) {
  return CARD_TONES[index % CARD_TONES.length];
}

export function CreateHuiButton({
  href,
  className,
  size = "lg",
}: {
  href: string;
  className?: string;
  size?: "lg" | "default";
}) {
  return (
    <HuiLinkButton href={href} size={size} shape="melt" className={cn("gap-2", className)}>
      <PlusIcon size={20} strokeWidth={2.4} />
      Create Hui
    </HuiLinkButton>
  );
}

function CardList({ events, startTone = 0 }: { events: HomeEvent[]; startTone?: number }) {
  return (
    <ul className="space-y-4">
      {events.map((event, index) => (
        <li key={event.id} className="hui-rise" style={{ animationDelay: `${Math.min(index, 5) * 50}ms` }}>
          <EventCard event={event} tone={toneFor(startTone + index)} />
        </li>
      ))}
    </ul>
  );
}

/** Home: what needs me, what is next, what else is brewing, and how to start something. */
export async function DashboardEvents() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }
  const supabase = await getServerSupabase();
  const { events, groups, proposableGroups } = await devTimed("dashboard:home-data", () =>
    loadHomeData(supabase, user.id),
  );
  const sections = splitHomeEvents(events);
  const createHref = createHuiHref(proposableGroups);

  const [featured, ...restUpcoming] = sections.upcoming;
  const shownPlanning = sections.planning.slice(0, 4);

  if (groups.length === 0) {
    return (
      <EmptyState
        className="mt-8"
        title="Start with your people"
        description="Create a group for your whānau or friends, or ask an admin to add you. Then you can propose your first hui."
      >
        <HuiLinkButton href="/groups/new" shape="melt">
          Create a group
        </HuiLinkButton>
      </EmptyState>
    );
  }

  const nothingPlanned =
    sections.attention.length === 0 &&
    sections.upcoming.length === 0 &&
    sections.planning.length === 0;

  return (
    <div className="space-y-9">
      {sections.attention.length > 0 ? (
        <section aria-labelledby="needs-attention" className="hui-rise">
          <SectionHeader
            id="needs-attention"
            title="Needs attention"
            description={
              sections.attention.length === 1
                ? "One thing is waiting on you."
                : `${sections.attention.length} things are waiting on you.`
            }
          />
          <div className="mt-4">
            <CardList events={sections.attention} startTone={1} />
          </div>
        </section>
      ) : null}

      {featured ? (
        <section aria-labelledby="upcoming-hui" className="hui-rise-2">
          <SectionHeader id="upcoming-hui" title="Upcoming" description="Confirmed by the group." />
          <div className="mt-4 space-y-4">
            <EventCard event={featured} variant="featured" tone="primary" />
            {restUpcoming.length > 0 ? (
              <CardList events={restUpcoming.slice(0, 3)} startTone={2} />
            ) : null}
          </div>
        </section>
      ) : null}

      {shownPlanning.length > 0 ? (
        <section aria-labelledby="being-planned" className="hui-rise-3">
          <SectionHeader
            id="being-planned"
            title="Being planned"
            description="Waiting for the group to agree on a time."
            action={
              sections.planning.length > shownPlanning.length ? (
                <Link href="/events" className="hui-link inline-flex min-h-11 items-center gap-1 text-sm">
                  See all
                  <ChevronRightIcon size={16} />
                </Link>
              ) : undefined
            }
          />
          <div className="mt-4">
            <CardList events={shownPlanning} startTone={1} />
          </div>
        </section>
      ) : null}

      {nothingPlanned ? (
        <EmptyState
          title="Nothing on the table yet"
          description={
            createHref
              ? "When someone proposes a time, it will land here. Be the first to get your group together."
              : "When someone in your groups proposes a time, it will land here."
          }
        />
      ) : null}

      {createHref ? (
        <div className="flex justify-center">
          <CreateHuiButton href={createHref} className="w-full max-w-sm" />
        </div>
      ) : null}

      <section aria-labelledby="your-groups">
        <SectionHeader
          id="your-groups"
          title="Your groups"
          action={
            <Link href="/groups" className="hui-link inline-flex min-h-11 items-center gap-1 text-sm">
              All groups
              <ChevronRightIcon size={16} />
            </Link>
          }
        />
        <ul className="hui-scroll-x -mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
          {groups.map((group, index) => (
            <li key={group.id} className="shrink-0">
              <Link
                href={`/groups/${group.id}`}
                className="hui-focus-ring flex items-center gap-3 rounded-full bg-surface py-2 pl-2 pr-5 text-sm font-extrabold text-foreground hui-shadow-sm transition-transform active:scale-95"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center text-sm font-black",
                    index % 2 === 0 ? "hui-shape-blob-a" : "hui-shape-blob-b",
                    index % 3 === 0 ? "bg-[var(--blob-sage)]" : index % 3 === 1 ? "bg-[var(--blob-blue)]" : "bg-[var(--blob-clay)]",
                  )}
                >
                  {group.name.trim().charAt(0).toUpperCase() || "G"}
                </span>
                {group.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function DashboardEventsSkeleton() {
  return (
    <div className="space-y-9" aria-busy="true" aria-label="Loading your gatherings">
      <div className="space-y-4">
        <div className="hui-skeleton h-5 w-36 !rounded-full" />
        <EventCardSkeleton featured />
      </div>
      <div className="space-y-4">
        <div className="hui-skeleton h-5 w-40 !rounded-full" />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </div>
    </div>
  );
}

/** Hui tab: every gathering across groups, grouped by what matters. */
export async function EventsOverview({ groupId }: { groupId?: string } = {}) {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }
  const supabase = await getServerSupabase();
  const { events, groups, proposableGroups } = await devTimed("events-page:home-data", () =>
    loadHomeData(supabase, user.id, { includePast: true, groupId }),
  );
  const sections = splitHomeEvents(events);
  const createHref = groupId
    ? proposableGroups.some((group) => group.id === groupId)
      ? `/groups/${groupId}/events/new`
      : null
    : createHuiHref(proposableGroups);
  const empty = events.length === 0;

  return (
    <div className="space-y-9">
      {createHref ? (
        <div className="flex">
          <CreateHuiButton href={createHref} size="default" className="w-full sm:w-auto" />
        </div>
      ) : null}

      {empty ? (
        <EmptyState
          title="No gatherings yet"
          description={
            groups.length === 0
              ? "Join or create a group first, then propose your first hui."
              : "Proposed and confirmed gatherings from all your groups will show up here."
          }
        >
          {groups.length === 0 ? (
            <HuiLinkButton href="/groups/new" shape="melt">
              Create a group
            </HuiLinkButton>
          ) : null}
        </EmptyState>
      ) : null}

      {sections.attention.length > 0 ? (
        <section aria-labelledby="events-needs-attention">
          <SectionHeader id="events-needs-attention" title="Needs attention" />
          <div className="mt-4">
            <CardList events={sections.attention} startTone={1} />
          </div>
        </section>
      ) : null}

      {sections.upcoming.length > 0 ? (
        <section aria-labelledby="events-upcoming">
          <SectionHeader id="events-upcoming" title="Coming up" description="Confirmed by the group." />
          <div className="mt-4">
            <CardList events={sections.upcoming} />
          </div>
        </section>
      ) : null}

      {sections.planning.length > 0 ? (
        <section aria-labelledby="events-planning">
          <SectionHeader
            id="events-planning"
            title="Being planned"
            description="Waiting for the group to agree on a time."
          />
          <div className="mt-4">
            <CardList events={sections.planning} startTone={2} />
          </div>
        </section>
      ) : null}

      {sections.past.length > 0 ? (
        <details className="hui-details rounded-hui-xl bg-surface hui-shadow-sm">
          <summary className="flex min-h-14 items-center justify-between gap-3 px-5 py-4">
            <span className="hui-type-section">Past gatherings ({sections.past.length})</span>
            <span className="hui-details-chevron text-muted-foreground" aria-hidden="true">
              <ChevronRightIcon size={20} className="rotate-90" />
            </span>
          </summary>
          <div className="px-4 pb-4">
            <CardList events={sections.past.slice(0, 8)} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function EventsOverviewSkeleton() {
  return <DashboardEventsSkeleton />;
}
