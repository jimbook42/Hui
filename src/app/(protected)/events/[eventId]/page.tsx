import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import {
  EventAttentionCard,
  EventBodySkeleton,
  EventDetailsList,
  EventHeroMeta,
  EventManageEntryCard,
  EventOpenDecisionsCard,
  EventPeopleCard,
  EventProposedGuidanceCard,
} from "@/components/events/event-page-sections";
import { AttendanceLiveProvider } from "@/components/events/attendance-live";
import { EventHero, EventHeroMetaSkeleton } from "@/components/hui/event-hero";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { getEventDetail } from "@/lib/events/queries";
import { devTimed } from "@/lib/perf/dev-server-timing";

type PageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ proposed?: string }>;
};

export default async function EventDetailPage({ params, searchParams }: PageProps) {
  const { eventId } = await params;
  const query = await searchParams;
  const justProposed = query.proposed === "1";
  const user = await devTimed("event-page:getUser", () => getServerAuthUser());
  const supabase = await getServerSupabase();

  const detail = await devTimed("event-page:event-detail", () =>
    getEventDetail(supabase, eventId, user!.id),
  );
  if (!detail) {
    notFound();
  }

  const userId = user!.id;

  return (
    <AppShell title={detail.title} hideTitle back={{ href: "/events", label: "Hui" }}>
      <AttendanceLiveProvider>
        <div className="space-y-5">
          <EventHero
            title={detail.title}
            status={detail.status}
            groupName={detail.groupName}
            groupHref={`/groups/${detail.groupId}`}
            location={detail.location}
            coordinates={detail.locationCoordinates}
          >
            <Suspense fallback={<EventHeroMetaSkeleton />}>
              <EventHeroMeta detail={detail} userId={userId} />
            </Suspense>
          </EventHero>

          <Suspense fallback={<EventBodySkeleton />}>
            {justProposed ? (
              <EventProposedGuidanceCard
                detail={detail}
                userId={userId}
                justProposed={true}
              />
            ) : null}
            <EventAttentionCard detail={detail} userId={userId} />
            <EventOpenDecisionsCard detail={detail} userId={userId} />
            <EventManageEntryCard detail={detail} userId={userId} />
            <EventPeopleCard detail={detail} userId={userId} />
            <EventDetailsList detail={detail} userId={userId} />
          </Suspense>
        </div>
      </AttendanceLiveProvider>
    </AppShell>
  );
}
