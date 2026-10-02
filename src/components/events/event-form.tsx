"use client";

import type { EventActionState } from "@/app/events/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import type { GroupSettingsRow } from "@/lib/groups/types";

type CreateEventFormProps = {
  action: (
    prev: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
  groupId: string;
  settings: GroupSettingsRow;
};

function formatDateTimeLocal(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateEventForm({ action, groupId, settings }: CreateEventFormProps) {
  const canOneOff = settings.oneOffEventsAllowed;
  const canRecurring = settings.recurringEventsEnabled;
  const defaultKind = canOneOff ? "one_off" : "recurring";

  return (
    <AuthForm action={action} submitLabel="Create event" hiddenFields={{ group_id: groupId }}>
      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        <span>Event type</span>
        <select
          name="event_kind"
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          defaultValue={defaultKind}
        >
          {canOneOff ? <option value="one_off">One-off</option> : null}
          {canRecurring ? <option value="recurring">Recurring series</option> : null}
        </select>
      </label>
      <AuthField label="Title" name="title" required />
      <AuthField label="Location (optional)" name="location" required={false} />
      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        <span>Notes (optional)</span>
        <textarea
          name="notes"
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
      {canRecurring ? (
        <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Recurrence (for recurring events)
          </legend>
          <AuthField label="Series title" name="series_title" required={false} />
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            <span>Cadence</span>
            <select
              name="interval_unit"
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
  scheduleLocked?: boolean;
};

export function EditEventForm({
  action,
  eventId,
  defaultTitle,
  defaultLocation,
  defaultNotes,
  defaultStartsAt,
  defaultEndsAt,
  scheduleLocked = false,
}: EditEventFormProps) {
  return (
    <AuthForm action={action} submitLabel="Save changes" hiddenFields={{ event_id: eventId }}>
      <AuthField label="Title" name="title" defaultValue={defaultTitle} />
      <AuthField
        label="Location (optional)"
        name="location"
        required={false}
        defaultValue={defaultLocation ?? ""}
      />
      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        <span>Notes (optional)</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes ?? ""}
          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>
      {scheduleLocked ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The confirmed time stays as agreed. Title, location, and notes can still be edited.
        </p>
      ) : (
        <>
          <AuthField
            label="Start (optional)"
            name="starts_at"
            type="datetime-local"
            required={false}
            defaultValue={formatDateTimeLocal(defaultStartsAt)}
          />
          <AuthField
            label="End (optional)"
            name="ends_at"
            type="datetime-local"
            required={false}
            defaultValue={formatDateTimeLocal(defaultEndsAt)}
          />
        </>
      )}
    </AuthForm>
  );
}
