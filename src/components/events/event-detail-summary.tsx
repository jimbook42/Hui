import { eventKindLabel } from "@/lib/events/labels";
import type { EventDetail } from "@/lib/events/types";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import { EventHero } from "@/components/hui/event-hero";
import { HuiSurface } from "@/components/hui/hui-surface";
import { SectionHeader } from "@/components/hui/section-header";

type EventDetailSummaryProps = {
  detail: EventDetail;
  displayTimeZone: string;
  formatWhen: (startsAt: string | null, endsAt: string | null, timeZone: string) => string;
  attendanceRoster?: AttendanceRoster | null;
};

export function EventDetailSummary({
  detail,
  displayTimeZone,
  formatWhen,
  attendanceRoster,
}: EventDetailSummaryProps) {
  const whenLabel = formatWhen(detail.startsAt, detail.endsAt, displayTimeZone);
  const confirmedWhen =
    detail.status === "confirmed" ? whenLabel : null;

  return (
    <>
      <EventHero
        title={detail.title}
        status={detail.status}
        whenLabel={whenLabel}
        startsAt={detail.startsAt}
        timeZone={displayTimeZone}
        location={detail.location}
        groupName={detail.groupName}
        proposerName={detail.creatorDisplayName}
        attendanceRoster={attendanceRoster}
        confirmedWhen={confirmedWhen}
      />

      {(detail.notes || detail.recurrenceSeries || detail.kind) ? (
        <HuiSurface className="mt-4 space-y-3" padding="md">
          <SectionHeader title="Details" />
          <dl className="grid gap-3 text-sm text-foreground">
            <div>
              <dt className="hui-type-label text-muted-foreground">Type</dt>
              <dd>{eventKindLabel(detail.kind)}</dd>
            </div>
            {detail.notes ? (
              <div>
                <dt className="hui-type-label text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-wrap">{detail.notes}</dd>
              </div>
            ) : null}
            {detail.recurrenceSeries ? (
              <div>
                <dt className="hui-type-label text-muted-foreground">Recurrence series</dt>
                <dd>
                  {detail.recurrenceSeries.title} — every{" "}
                  {detail.recurrenceSeries.intervalCount}{" "}
                  {detail.recurrenceSeries.intervalUnit}(s) from{" "}
                  {detail.recurrenceSeries.startsOn}
                  {detail.recurrenceSeries.archivedAt ? " (inactive)" : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        </HuiSurface>
      ) : null}
    </>
  );
}
