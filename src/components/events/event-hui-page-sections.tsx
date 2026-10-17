import {
  EventCollapsedInviteSection,
  EventMainTimesSection,
  EventOrganiserToolsSection,
  EventPlanningHelpSection,
  EventSummaryHeader,
} from "@/components/events/event-compact-hui-sections";
import {
  EventAttentionCard,
  EventDetailsList,
  EventHostGentlePromptSection,
  HostSwappedConfirmationCard,
} from "@/components/events/event-page-sections";
import { RescheduledFromSection } from "@/components/events/rescheduled-from-section";
import { ResponseDeadlinePassedSection } from "@/components/events/response-deadline-section";
import { StaleProposalSection } from "@/components/events/stale-proposal-section";
import type { EventDetail } from "@/lib/events/types";

export type EventHuiPageSectionsProps = {
  detail: EventDetail;
  userId: string;
  justProposed?: boolean;
  justSwappedHost?: boolean;
};

/**
 * Compact hui page body (everything under the hero shell). Shared by the route and
 * composition tests so layout regressions are caught with fixture data only.
 */
export async function EventHuiPageSections({
  detail,
  userId,
  justProposed = false,
  justSwappedHost = false,
}: EventHuiPageSectionsProps) {
  const showPlanningHelp =
    detail.status === "proposing" && (justProposed || detail.createdBy === userId);

  return (
    <>
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
    </>
  );
}

/**
 * Resolves async server sections for Vitest (client render cannot suspend on RSC children).
 */
export async function EventHuiPageSectionsResolved(props: EventHuiPageSectionsProps) {
  const { detail, userId, justProposed = false, justSwappedHost = false } = props;
  const showPlanningHelp =
    detail.status === "proposing" && (justProposed || detail.createdBy === userId);

  return (
    <>
      {await EventSummaryHeader({ detail, userId })}
      {await EventMainTimesSection({ detail, userId })}
      {await EventAttentionCard({ detail, userId })}
      {await EventCollapsedInviteSection({ detail, userId, justProposed })}
      {showPlanningHelp
        ? await EventPlanningHelpSection({ detail, userId, justProposed })
        : null}
      {justSwappedHost ? <HostSwappedConfirmationCard /> : null}
      {await RescheduledFromSection({ detail, userId })}
      {await StaleProposalSection({ detail, userId })}
      {await ResponseDeadlinePassedSection({ detail, userId })}
      {await EventHostGentlePromptSection({ detail, userId })}
      {await EventOrganiserToolsSection({ detail, userId })}
      {await EventDetailsList({ detail, userId })}
    </>
  );
}
