import Link from "next/link";

import { HuiSurface } from "@/components/hui/hui-surface";
import { deadlinePassedReplySummary } from "@/domain/scheduling/response-deadline";
import { eventManagePath } from "@/lib/events/paths";

type ResponseDeadlinePassedBannerProps = {
  eventId: string;
  respondedCount: number;
  eligibleCount: number;
};

export function ResponseDeadlinePassedBanner({
  eventId,
  respondedCount,
  eligibleCount,
}: ResponseDeadlinePassedBannerProps) {
  return (
    <HuiSurface tone="clay" shape="soft" padding="md" className="hui-rise-2" role="status">
      <p className="text-lg font-extrabold text-foreground">
        {deadlinePassedReplySummary(respondedCount, eligibleCount)}
      </p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        Review replies and confirm a time, or cancel the hui if planning is not working out.
      </p>
      <p className="mt-3">
        <Link href={eventManagePath(eventId)} className="hui-link text-sm font-bold">
          Manage scheduling
        </Link>
      </p>
    </HuiSurface>
  );
}
