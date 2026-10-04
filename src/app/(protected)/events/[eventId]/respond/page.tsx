import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { EventParticipantRespondFlow } from "@/components/events/event-participant-respond-flow";
import { loadRespondPrimary, loadRespondSecondary } from "@/lib/events/respond-page-data";
import { eventDetailPath } from "@/lib/events/paths";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { devTimed } from "@/lib/perf/dev-server-timing";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EventParticipantRespondPage({ params }: PageProps) {
  const { eventId } = await params;
  const user = await devTimed("respond-page:getUser", () => getServerAuthUser());
  if (!user) {
    notFound();
  }

  const supabase = await getServerSupabase();

  const primary = await devTimed("respond-page:primary", () =>
    loadRespondPrimary(supabase, eventId, user.id),
  );

  if (primary === null) {
    notFound();
  }

  if (primary === "unavailable") {
    return (
      <AppShell title="Respond">
        <div className="mx-auto max-w-md space-y-4">
          <p className="text-sm text-muted-foreground">
            This event is not waiting for an attendance response right now.
          </p>
          <Link
            href={eventDetailPath(eventId)}
            className="hui-link text-sm font-medium"
          >
            View event details
          </Link>
        </div>
      </AppShell>
    );
  }

  const secondaryDataPromise = loadRespondSecondary(
    supabase,
    primary.detail.id,
    primary.detail.groupId,
  );

  return (
    <AppShell title="Your response">
      <EventParticipantRespondFlow
        eventId={primary.detail.id}
        groupId={primary.detail.groupId}
        eventTitle={primary.detail.title}
        groupName={primary.detail.groupName}
        timeZone={primary.displayTimeZone}
        maybeResponsesEnabled={primary.maybeResponsesEnabled}
        canRespond={primary.canRespond}
        canCoordinateContributions={primary.canCoordinateContributions}
        canSuggestTime={primary.canSuggestTime}
        candidate={primary.candidate}
        placeView={primary.placeView}
        coordinates={primary.detail.locationCoordinates}
        hostingEnabled={primary.hostingEnabled}
        viewerUserId={user.id}
        initialViewerResponse={primary.candidate.viewerResponse}
        secondaryDataPromise={secondaryDataPromise}
      />
    </AppShell>
  );
}
