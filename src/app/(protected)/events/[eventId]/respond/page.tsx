import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { EventParticipantRespondFlow } from "@/components/events/event-participant-respond-flow";
import { canCoordinateContributions } from "@/domain/contributions/permissions";
import {
  canSuggestAlternativeTimeInFlow,
  canUseParticipantRespondFlow,
  pickParticipantTimeCandidate,
} from "@/domain/events/participant-flow";
import { participantPlaceView } from "@/domain/events/participant-place";
import { canRespondToCandidates } from "@/domain/scheduling/permissions";
import { listContributionCategories, listEventContributions } from "@/lib/contributions/queries";
import { getEventDetail } from "@/lib/events/queries";
import { eventDetailPath } from "@/lib/events/paths";
import { getGroupDetail } from "@/lib/groups/queries";
import { getEventHostContext } from "@/lib/hosts/queries";
import { getEventSchedulingContext } from "@/lib/scheduling/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EventParticipantRespondPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    notFound();
  }

  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    notFound();
  }

  const group = await getGroupDetail(supabase, detail.groupId, user.id);
  if (!group) {
    notFound();
  }

  const [scheduling, contributions, categories, hostContext] = await Promise.all([
    getEventSchedulingContext(supabase, detail.id, detail.groupId, user.id),
    listEventContributions(supabase, detail.id),
    listContributionCategories(supabase, detail.groupId),
    getEventHostContext(supabase, detail.id, detail.groupId, user.id),
  ]);

  const primary = pickParticipantTimeCandidate(scheduling.candidates);
  const candidate =
    primary === null
      ? null
      : (scheduling.candidates.find((row) => row.id === primary.id) ?? null);
  const displayTimeZone =
    detail.timezone ?? group.settings.timezone ?? "Pacific/Auckland";
  const canRespond = canRespondToCandidates(detail.status);
  const flowAvailable = canUseParticipantRespondFlow({
    eventStatus: detail.status,
    hasCandidate: candidate !== null,
  });

  const place = participantPlaceView({
    eventStatus: detail.status,
    eventLocation: detail.location,
    acceptedHostDisplayName: hostContext.view.acceptedHost?.displayName ?? null,
    hostingEnabled: group.settings.hostingEnabled,
  });

  if (!flowAvailable || !candidate) {
    return (
      <AppShell title="Respond">
        <div className="mx-auto max-w-md space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            This event is not waiting for an attendance response right now.
          </p>
          <Link
            href={eventDetailPath(eventId)}
            className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline dark:text-sky-400"
          >
            View event details
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Your response">
      <EventParticipantRespondFlow
        eventId={detail.id}
        groupId={detail.groupId}
        eventTitle={detail.title}
        groupName={detail.groupName}
        timeZone={displayTimeZone}
        maybeResponsesEnabled={scheduling.maybeResponsesEnabled}
        canRespond={canRespond}
        canCoordinateContributions={canCoordinateContributions(detail.status)}
        canSuggestTime={canSuggestAlternativeTimeInFlow(
          detail.viewerRole,
          group.settings,
          detail.status,
        )}
        candidate={candidate}
        placeView={place}
        hostingEnabled={group.settings.hostingEnabled}
        categories={categories}
        contributions={contributions}
        viewerUserId={user.id}
        initialViewerResponse={candidate.viewerResponse}
      />
    </AppShell>
  );
}
