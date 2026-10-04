import { eventKindLabel, eventStatusLabel } from "@/lib/events/labels";
import type { EventDetail } from "@/lib/events/types";

type EventDetailSummaryProps = {
  detail: EventDetail;
  displayTimeZone: string;
  formatWhen: (startsAt: string | null, endsAt: string | null, timeZone: string) => string;
};

export function EventDetailSummary({
  detail,
  displayTimeZone,
  formatWhen,
}: EventDetailSummaryProps) {
  return (
    <dl className="mt-8 grid gap-3 text-sm text-zinc-800 dark:text-zinc-200">
      <div>
        <dt className="text-zinc-500">Status</dt>
        <dd>{eventStatusLabel(detail.status)}</dd>
      </div>
      <div>
        <dt className="text-zinc-500">Type</dt>
        <dd>{eventKindLabel(detail.kind)}</dd>
      </div>
      <div>
        <dt className="text-zinc-500">Proposed by</dt>
        <dd>{detail.creatorDisplayName}</dd>
      </div>
      <div>
        <dt className="text-zinc-500">When</dt>
        <dd>{formatWhen(detail.startsAt, detail.endsAt, displayTimeZone)}</dd>
      </div>
      {detail.location ? (
        <div>
          <dt className="text-zinc-500">Location</dt>
          <dd>{detail.location}</dd>
        </div>
      ) : null}
      {detail.notes ? (
        <div>
          <dt className="text-zinc-500">Notes</dt>
          <dd className="whitespace-pre-wrap">{detail.notes}</dd>
        </div>
      ) : null}
      {detail.recurrenceSeries ? (
        <div>
          <dt className="text-zinc-500">Recurrence series</dt>
          <dd>
            {detail.recurrenceSeries.title} — every {detail.recurrenceSeries.intervalCount}{" "}
            {detail.recurrenceSeries.intervalUnit}(s) from {detail.recurrenceSeries.startsOn}
            {detail.recurrenceSeries.archivedAt ? " (inactive)" : ""}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
