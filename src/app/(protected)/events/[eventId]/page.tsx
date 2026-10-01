import Link from "next/link";
import { notFound } from "next/navigation";

import { updateEventAction } from "@/app/events/actions";
import { AppShell } from "@/components/app/app-shell";
import { CancelEventButton } from "@/components/events/cancel-event-button";
import { EditEventForm } from "@/components/events/event-form";
import {
  canCancelEvent,
  canEditEventMetadata,
} from "@/domain/events/permissions";
import { getEventDetail } from "@/lib/events/queries";
import { eventKindLabel, eventStatusLabel } from "@/lib/events/labels";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

function formatWhen(iso: string | null): string {
  if (!iso) {
    return "Not set";
  }
  return new Date(iso).toLocaleString();
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const detail = await getEventDetail(supabase, eventId, user!.id);
  if (!detail) {
    notFound();
  }

  const canEdit = canEditEventMetadata(
    detail.viewerRole,
    user!.id,
    detail.createdBy,
    detail.status,
  );
  const canCancel = canCancelEvent(
    detail.viewerRole,
    user!.id,
    detail.createdBy,
    detail.status,
  );

  return (
    <AppShell title={detail.title}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          href={`/groups/${detail.groupId}`}
          className="underline-offset-4 hover:underline"
        >
          {detail.groupName}
        </Link>
        {" · "}
        <Link
          href={`/groups/${detail.groupId}/events`}
          className="underline-offset-4 hover:underline"
        >
          Events
        </Link>
      </p>

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
          <dd>
            {formatWhen(detail.startsAt)}
            {detail.endsAt ? ` — ${formatWhen(detail.endsAt)}` : ""}
          </dd>
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

      {canEdit ? (
        <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Edit</h2>
          <div className="mt-4 max-w-lg">
            <EditEventForm
              action={updateEventAction}
              eventId={detail.id}
              defaultTitle={detail.title}
              defaultLocation={detail.location}
              defaultNotes={detail.notes}
              defaultStartsAt={detail.startsAt}
              defaultEndsAt={detail.endsAt}
            />
          </div>
        </section>
      ) : null}

      {canCancel ? (
        <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Cancel</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Cancelling keeps the event record but marks it as cancelled.
          </p>
          <CancelEventButton eventId={detail.id} />
        </section>
      ) : null}
    </AppShell>
  );
}
