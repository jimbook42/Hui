import { StaleProposalBanner } from "@/components/events/stale-proposal-banner";
import {
  isProposingEventStale,
  resolveProposalNominalDate,
} from "@/domain/events/stale-proposal";
import { todayDateOnlyInTimeZone } from "@/lib/groups/planning-cycle";
import { loadEventPage } from "@/lib/events/event-page-data";
import type { EventDetail } from "@/lib/events/types";

type Props = {
  detail: EventDetail;
  userId: string;
};

export async function StaleProposalSection({ detail, userId }: Props) {
  if (detail.status !== "proposing") {
    return null;
  }

  const data = await loadEventPage(detail, userId);
  const timeZone = detail.timezone ?? data.displayTimeZone;
  const today = todayDateOnlyInTimeZone(timeZone);
  const nominal = resolveProposalNominalDate({
    planningTargetDate: detail.planningTargetDate,
    candidateStartInstants: data.scheduling.candidates.map((c) => c.startsAt),
    timeZone,
  });

  if (!isProposingEventStale(detail.status, nominal, today)) {
    return null;
  }

  const canManage = data.canAccessManage;

  return (
    <StaleProposalBanner
      eventId={detail.id}
      nominalDate={nominal!}
      canManage={canManage}
      minDate={today}
      suggestedDate={today}
    />
  );
}
