"use client";

import { useState } from "react";

import {
  addStandingAvailabilityWindowAction,
  deleteStandingAvailabilityWindowAction,
} from "@/app/availability/actions";
import { AuthForm } from "@/components/auth/auth-form";
import {
  formatStandingWindowLabel,
  standingAvailabilityDayLabel,
  type StandingAvailabilityWindow,
} from "@/domain/scheduling/standing-availability";

type StandingAvailabilityEditorProps = {
  groupId: string;
  groupName: string;
  timeZone: string;
  windows: StandingAvailabilityWindow[];
};

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6];

export function StandingAvailabilityEditor({
  groupId,
  groupName,
  timeZone,
  windows,
}: StandingAvailabilityEditorProps) {
  const [allDay, setAllDay] = useState(false);

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-muted-foreground">
        Times follow <span className="text-foreground">{groupName}</span>&apos;s timezone (
        {timeZone}). These are defaults only — you still choose for each hui.
      </p>

      {windows.length === 0 ? (
        <p className="hui-type-supporting">No usual availability saved for this group yet.</p>
      ) : (
        <ul className="space-y-2">
          {windows.map((window) => (
            <li
              key={window.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-hui-lg bg-muted px-3 py-2 text-sm"
            >
              <span className="font-semibold text-foreground">
                {formatStandingWindowLabel(window)}
              </span>
              <AuthForm
                action={deleteStandingAvailabilityWindowAction}
                submitLabel="Remove"
                hiddenFields={{ window_id: window.id, group_id: groupId }}
                refreshOnSuccess
              >
                {null}
              </AuthForm>
            </li>
          ))}
        </ul>
      )}

      <AuthForm
        action={addStandingAvailabilityWindowAction}
        submitLabel="Add window"
        hiddenFields={{ group_id: groupId }}
        refreshOnSuccess
      >
        <div className="space-y-3 rounded-hui-lg bg-surface p-4 hui-shadow-sm">
          <h3 className="text-sm font-bold text-foreground">Add usual availability</h3>
          <label className="hui-label">
            <span>Day</span>
            <select name="day_of_week" className="hui-input" defaultValue="5">
              {DAY_OPTIONS.map((day) => (
                <option key={day} value={day}>
                  {standingAvailabilityDayLabel(day)}
                </option>
              ))}
            </select>
          </label>
          <label className="hui-label">
            <span>Usually</span>
            <select name="kind" className="hui-input" defaultValue="usually_available">
              <option value="usually_available">Available</option>
              <option value="usually_unavailable">Unavailable</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              name="all_day"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
            />
            All day
          </label>
          {!allDay ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="hui-label">
                <span>From</span>
                <input
                  type="time"
                  name="start_time"
                  className="hui-input"
                  defaultValue="17:30"
                  required
                />
              </label>
              <label className="hui-label">
                <span>Until</span>
                <input
                  type="time"
                  name="end_time"
                  className="hui-input"
                  defaultValue="22:00"
                  required
                />
              </label>
            </div>
          ) : null}
        </div>
      </AuthForm>
    </div>
  );
}
