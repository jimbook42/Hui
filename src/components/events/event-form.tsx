"use client";

import type { EventActionState } from "@/app/events/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { EventLocationFields } from "@/components/map/event-location-fields";
import { formatDateTimeLocalInTimeZone } from "@/domain/datetime/timezone";
import type { EventCoordinates } from "@/domain/events/location";
import type { GroupMemberRow, GroupSettingsRow } from "@/lib/groups/types";
import { useState } from "react";

type CreateEventFormProps = {
  action: (
    prev: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
  groupId: string;
  settings: GroupSettingsRow;
  isFirstGroupEvent?: boolean;
  members?: GroupMemberRow[];
};

export function CreateEventForm({
  action,
  groupId,
  settings,
  isFirstGroupEvent = false,
  members = [],
}: CreateEventFormProps) {
  const canOneOff = settings.oneOffEventsAllowed;
  const canRecurring = settings.recurringEventsEnabled;
  const defaultKind = canOneOff ? "one_off" : "recurring";

  return (
    <AuthForm action={action} submitLabel="Create event" hiddenFields={{ group_id: groupId }}>
      <label className="hui-label">
        <span>Event type</span>
        <select
          name="event_kind"
          className="hui-input"
          defaultValue={defaultKind}
        >
          {canOneOff ? <option value="one_off">One-off</option> : null}
          {canRecurring ? <option value="recurring">Recurring series</option> : null}
        </select>
      </label>
      <AuthField label="Title" name="title" required />
      <AuthField label="Location (optional)" name="location" required={false} />
      <label className="hui-label">
        <span>Notes (optional)</span>
        <textarea
          name="notes"
          rows={3}
          className="hui-input"
        />
      </label>
      <AuthField
        label="Start (optional)"
        name="starts_at"
        type="datetime-local"
        required={false}
      />
      <AuthField
        label="End (optional)"
        name="ends_at"
        type="datetime-local"
        required={false}
      />
      {isFirstGroupEvent && settings.hostingEnabled ? (
        <label className="hui-label">
          <span>Initial host (first gathering)</span>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            Your choice is a proposal — they still accept or ask to swap. Later events use
            Hui&apos;s usual host suggestions.
          </p>
          <select
            name="initial_host_user_id"
            className="hui-input"
            defaultValue=""
          >
            <option value="">Let Hui suggest when people respond</option>
            <option value="__none__">No host for this event</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {canRecurring ? (
        <fieldset className="space-y-3 rounded-hui-md p-4 bg-muted">
          <legend className="px-1 text-sm font-medium text-foreground">
            Recurrence (for recurring events)
          </legend>
          <AuthField label="Series title" name="series_title" required={false} />
          <label className="hui-label">
            <span>Cadence</span>
            <select
              name="interval_unit"
              className="hui-input"
              defaultValue="month"
            >
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </label>
          <AuthField label="Every (interval)" name="interval_count" defaultValue="1" />
          <AuthField label="Series starts on" name="series_starts_on" type="date" required={false} />
        </fieldset>
      ) : null}
    </AuthForm>
  );
}

type EditEventFormProps = {
  action: (
    prev: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
  eventId: string;
  defaultTitle: string;
  defaultLocation: string | null;
  defaultNotes: string | null;
  defaultStartsAt: string | null;
  defaultEndsAt: string | null;
  defaultCoordinates?: EventCoordinates | null;
  scheduleLocked?: boolean;
  timeZone: string;
};

export function EditEventForm({
  action,
  eventId,
  defaultTitle,
  defaultLocation,
  defaultNotes,
  defaultStartsAt,
  defaultEndsAt,
  defaultCoordinates = null,
  scheduleLocked = false,
  timeZone,
}: EditEventFormProps) {
  const [location, setLocation] = useState(defaultLocation ?? "");
  const [coordinates, setCoordinates] = useState<EventCoordinates | null>(defaultCoordinates);

  return (
    <AuthForm action={action} submitLabel="Save changes" hiddenFields={{ event_id: eventId }}>
      <AuthField label="Title" name="title" defaultValue={defaultTitle} />
      <input type="hidden" name="location" value={location} />
      <input type="hidden" name="location_lat" value={coordinates ? String(coordinates.lat) : ""} />
      <input type="hidden" name="location_lng" value={coordinates ? String(coordinates.lng) : ""} />
      <EventLocationFields
        location={location}
        onLocationChange={setLocation}
        coordinates={coordinates}
        onCoordinatesChange={setCoordinates}
        locationLabel="Location (optional)"
        defaultMapOpen={coordinates !== null}
      />
      <label className="hui-label">
        <span>Notes (optional)</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes ?? ""}
          className="hui-input"
        />
      </label>
      {scheduleLocked ? (
        <p className="text-sm text-muted-foreground">
          The confirmed time stays as agreed. Title, location, and notes can still be edited.
        </p>
      ) : (
        <>
          <AuthField
            label="Start (optional)"
            name="starts_at"
            type="datetime-local"
            required={false}
            defaultValue={
              defaultStartsAt
                ? formatDateTimeLocalInTimeZone(defaultStartsAt, timeZone)
                : ""
            }
          />
          <AuthField
            label="End (optional)"
            name="ends_at"
            type="datetime-local"
            required={false}
            defaultValue={
              defaultEndsAt ? formatDateTimeLocalInTimeZone(defaultEndsAt, timeZone) : ""
            }
          />
        </>
      )}
    </AuthForm>
  );
}
