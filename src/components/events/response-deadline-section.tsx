import { ResponseDeadlinePassedBanner } from "@/components/events/response-deadline-passed-banner";
import { eventAcceptsResponseDeadline } from "@/domain/events/response-deadline-status";
import { isResponseDeadlinePassed } from "@/domain/scheduling/response-deadline";
import { getServerSupabase } from "@/lib/auth/server-session";
import { loadEventPage } from "@/lib/events/event-page-data";
import { getEventProposalReplyStats } from "@/lib/events/proposal-reply-stats";
import type { EventDetail } from "@/lib/events/types";

type Props = {
  detail: EventDetail;
  userId: string;
};

export async function ResponseDeadlinePassedSection({ detail, userId }: Props) {
  if (
    !eventAcceptsResponseDeadline(detail.status) ||
    !detail.responseDeadlineAt ||
    !isResponseDeadlinePassed(detail.responseDeadlineAt)
  ) {
    return null;
  }

  const data = await loadEventPage(detail, userId);
  if (!data.canFinalise && !data.canEdit) {
    return null;
  }

  const supabase = await getServerSupabase();
  const stats = await getEventProposalReplyStats(supabase, detail.id);
  if (!stats) {
    return null;
  }

  return (
    <ResponseDeadlinePassedBanner
      eventId={detail.id}
      respondedCount={stats.respondedMemberCount}
      eligibleCount={stats.eligibleMemberCount}
    />
  );
}
