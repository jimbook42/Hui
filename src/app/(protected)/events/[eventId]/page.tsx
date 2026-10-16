import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import {
  EventCollapsedInviteSection,
  EventMainTimesSection,
  EventOrganiserToolsSection,
  EventPlanningHelpSection,
  EventSummaryHeader,
} from "@/components/events/event-compact-hui-sections";
import {
  EventAttentionCard,
  EventHostGentlePromptSection,
  EventBodySkeleton,
  EventDetailsList,
  EventHeroMeta,
  HostSwappedConfirmationCard,
} from "@/components/events/event-page-sections";
import { RescheduledFromSection } from "@/components/events/rescheduled-from-section";
import { ResponseDeadlinePassedSection } from "@/components/events/response-deadline-section";
import { StaleProposalSection } from "@/components/events/stale-proposal-section";
import { EventRespondSavedToast } from "@/components/events/event-respond-saved-toast";
import { AttendanceLiveProvider } from "@/components/events/attendance-live";
import { EventLifecycleLiveRefresh } from "@/components/events/event-lifecycle-live-refresh";
import { EventHero } from "@/components/hui/event-hero";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { loadEventPage } from "@/lib/events/event-page-data";
import { requireEventDetail } from "@/lib/events/require-event-detail";
import { resolveAuthRedirectOrigin } from "@/lib/auth/app-origin";
import { confirmedEventConsensusPassesForDisplay } from "@/domain/scheduling/confirmed-because";
import { devTimed } from "@/lib/perf/dev-server-timing";

type PageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ proposed?: string; host_swapped?: string }>;
};

export default async function EventDetailPage({ params, searchParams }: PageProps) {
  const { eventId } = await params;
  const query = await searchParams;
  const justProposed = query.proposed === "1";
  const justSwappedHost = query.host_swapped === "1";
  const user = await devTimed("event-page:getUser", () => getServerAuthUser());
  const supabase = await getServerSupabase();

  const detail = await devTimed("event-page:event-detail", () =>
    requireEventDetail(supabase, eventId, user!.id),
  );

  const userId = user!.id;
  const [heroPageData, appOrigin, inviteTokenResult] = await Promise.all([
    loadEventPage(detail, userId),
    resolveAuthRedirectOrigin(),
    supabase.rpc("get_group_invite_link", { p_group_id: detail.groupId }),
  ]);
  const inviteToken =
    !inviteTokenResult.error && typeof inviteTokenResult.data === "string"
      ? inviteTokenResult.data
      : null;

  const showPlanningHelp =
    detail.status === "proposing" && (justProposed || detail.createdBy === userId);

  return (
    <AppShell title={detail.title} hideTitle back={{ href: "/events", label: "Hui" }}>
      <AttendanceLiveProvider>
        <EventLifecycleLiveRefresh eventId={detail.id} status={detail.status} />
        <Suspense fallback={null}>
          <EventRespondSavedToast />
        </Suspense>
        <div className="space-y-3">
          <EventHero
            title={detail.title}
            status={detail.status}
            consensusCurrentlyPasses={
              detail.status === "confirmed"
                ? confirmedEventConsensusPassesForDisplay(
                    heroPageData.anyCandidatePasses,
                    detail.confirmationMethod,
                  )
                : undefined
            }
            groupName={detail.groupName}
            groupHref={`/groups/${detail.groupId}`}
            location={detail.location}
            coordinates={detail.locationCoordinates}
          >
            <EventHeroMeta
              detail={detail}
              userId={userId}
              pageData={heroPageData}
              appOrigin={appOrigin}
              inviteToken={inviteToken}
            />
          </EventHero>

          <Suspense fallback={<EventBodySkeleton />}>
            <EventSummaryHeader detail={detail} userId={userId} />
            <EventMainTimesSection detail={detail} userId={userId} />
            <EventAttentionCard detail={detail} userId={userId} />
            <EventCollapsedInviteSection
              detail={detail}
              userId={userId}
              justProposed={justProposed}
            />
            {showPlanningHelp ? (
              <EventPlanningHelpSection
                detail={detail}
                userId={userId}
                justProposed={justProposed}
              />
            ) : null}
            {justSwappedHost ? <HostSwappedConfirmationCard /> : null}
            <RescheduledFromSection detail={detail} userId={userId} />
            <StaleProposalSection detail={detail} userId={userId} />
            <ResponseDeadlinePassedSection detail={detail} userId={userId} />
            <EventHostGentlePromptSection detail={detail} userId={userId} />
            <EventOrganiserToolsSection detail={detail} userId={userId} />
            <EventDetailsList detail={detail} userId={userId} />
          </Suspense>
        </div>
      </AttendanceLiveProvider>
    </AppShell>
  );
}
