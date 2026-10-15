import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import {
  EventAttentionCard,
  EventHostGentlePromptSection,
  EventBodySkeleton,
  EventDetailsList,
  EventHeroMeta,
  EventManageEntryCard,
  EventOpenDecisionsCard,
  EventPeopleCard,
  EventProposedGuidanceCard,
  HostSwappedConfirmationCard,
} from "@/components/events/event-page-sections";
import { RescheduledFromSection } from "@/components/events/rescheduled-from-section";
import { ResponseDeadlinePassedSection } from "@/components/events/response-deadline-section";
import { StaleProposalSection } from "@/components/events/stale-proposal-section";
import { EventProposeInviteSection } from "@/components/events/event-propose-invite-section";
import { EventRespondSavedToast } from "@/components/events/event-respond-saved-toast";
import { AttendanceLiveProvider } from "@/components/events/attendance-live";
import { EventLifecycleLiveRefresh } from "@/components/events/event-lifecycle-live-refresh";
import { EventHero } from "@/components/hui/event-hero";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { loadEventPage } from "@/lib/events/event-page-data";
import { getEventDetail } from "@/lib/events/queries";
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
    getEventDetail(supabase, eventId, user!.id),
  );
  if (!detail) {
    notFound();
  }

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

  return (
    <AppShell title={detail.title} hideTitle back={{ href: "/events", label: "Hui" }}>
      <AttendanceLiveProvider>
        <EventLifecycleLiveRefresh eventId={detail.id} status={detail.status} />
        <Suspense fallback={null}>
          <EventRespondSavedToast />
        </Suspense>
        <div className="space-y-5">
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
            {detail.status === "proposing" &&
            (justProposed || detail.createdBy === userId) ? (
              <EventProposedGuidanceCard
                detail={detail}
                userId={userId}
                justProposed={justProposed}
              />
            ) : null}
            {justSwappedHost ? (
              <HostSwappedConfirmationCard />
            ) : null}
            {detail.status === "proposing" &&
            (detail.createdBy === userId || detail.viewerRole === "owner" || detail.viewerRole === "admin") ? (
              <EventProposeInviteSection
                detail={detail}
                inviterDisplayName={detail.creatorDisplayName}
                gatheringType={detail.gatheringType}
                gatheringTypeCustom={detail.gatheringTypeCustom}
                planningTargetDate={detail.planningTargetDate}
                timeZone={detail.timezone ?? "Pacific/Auckland"}
                prominent={justProposed}
              />
            ) : null}
            <RescheduledFromSection detail={detail} userId={userId} />
            <StaleProposalSection detail={detail} userId={userId} />
            <ResponseDeadlinePassedSection detail={detail} userId={userId} />
            <EventAttentionCard detail={detail} userId={userId} />
            <EventHostGentlePromptSection detail={detail} userId={userId} />
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
