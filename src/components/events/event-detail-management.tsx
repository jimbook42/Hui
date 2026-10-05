import type { EventActionState } from "@/app/events/actions";
import { CancelEventButton } from "@/components/events/cancel-event-button";
import { DeleteEventForm } from "@/components/events/delete-event-form";
import { EditEventForm } from "@/components/events/event-form";
import { HostEventLocationForm } from "@/components/events/host-event-location-form";
import type { EventCoordinates } from "@/domain/events/location";
import type { EventStatus } from "@/domain/events/types";

type EventDetailManagementProps = {
  canEdit: boolean;
  canEditLocation: boolean;
  canCancel: boolean;
  canDelete?: boolean;
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
  defaultCoordinates: EventCoordinates | null;
  status: EventStatus;
  timeZone: string;
};

export function EventDetailManagement({
  canEdit,
  canEditLocation,
  canCancel,
  canDelete = false,
  eventId,
  updateAction,
  defaultTitle,
  defaultLocation,
  defaultNotes,
  defaultStartsAt,
  defaultEndsAt,
  defaultCoordinates,
  status,
  timeZone,
}: EventDetailManagementProps) {
  if (!canEdit && !canEditLocation && !canCancel && !canDelete) {
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
              defaultCoordinates={defaultCoordinates}
              scheduleLocked={status === "confirmed"}
              timeZone={timeZone}
            />
          </div>
        </section>
      ) : canEditLocation ? (
        <section className="hui-card-section">
          <h3 className="hui-type-section text-foreground">Confirm the place</h3>
          <div className="mt-4 max-w-lg">
            <HostEventLocationForm
              action={updateAction}
              eventId={eventId}
              defaultTitle={defaultTitle}
              defaultNotes={defaultNotes}
              defaultLocation={defaultLocation}
              defaultCoordinates={defaultCoordinates}
            />
          </div>
        </section>
      ) : null}

      {canCancel ? (
        <section className="hui-card-section">
          <h3 className="hui-type-section text-foreground">Cancel</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Cancelling keeps the hui record but marks it as cancelled.
          </p>
          <CancelEventButton eventId={eventId} />
        </section>
      ) : null}

      {canDelete ? (
        <section className="hui-card-section">
          <h3 className="hui-type-section text-foreground">Delete</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Deleting removes this hui and its planning data permanently. Cancelled hui stay in history
            until you delete them.
          </p>
          <div className="mt-4">
            <DeleteEventForm eventId={eventId} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
