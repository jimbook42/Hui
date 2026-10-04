import type { EventActionState } from "@/app/events/actions";
import { CancelEventButton } from "@/components/events/cancel-event-button";
import { EditEventForm } from "@/components/events/event-form";
import type { EventStatus } from "@/domain/events/types";

type EventDetailManagementProps = {
  canEdit: boolean;
  canCancel: boolean;
  eventId: string;
  updateAction: (
    prev: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
  defaultTitle: string;
  defaultLocation: string | null;
  defaultNotes: string | null;
  defaultStartsAt: string | null;
  defaultEndsAt: string | null;
  status: EventStatus;
  timeZone: string;
};

export function EventDetailManagement({
  canEdit,
  canCancel,
  eventId,
  updateAction,
  defaultTitle,
  defaultLocation,
  defaultNotes,
  defaultStartsAt,
  defaultEndsAt,
  status,
  timeZone,
}: EventDetailManagementProps) {
  if (!canEdit && !canCancel) {
    return null;
  }

  return (
    <>
      {canEdit ? (
        <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Edit</h2>
          <div className="mt-4 max-w-lg">
            <EditEventForm
              action={updateAction}
              eventId={eventId}
              defaultTitle={defaultTitle}
              defaultLocation={defaultLocation}
              defaultNotes={defaultNotes}
              defaultStartsAt={defaultStartsAt}
              defaultEndsAt={defaultEndsAt}
              scheduleLocked={status === "confirmed"}
              timeZone={timeZone}
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
          <CancelEventButton eventId={eventId} />
        </section>
      ) : null}
    </>
  );
}
