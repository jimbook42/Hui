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
    <div className="space-y-8">
      {canEdit ? (
        <section className="hui-card-section">
          <h3 className="hui-type-section text-foreground">Edit</h3>
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
        <section className="hui-card-section">
          <h3 className="hui-type-section text-foreground">Cancel</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Cancelling keeps the event record but marks it as cancelled.
          </p>
          <CancelEventButton eventId={eventId} />
        </section>
      ) : null}
    </div>
  );
}
