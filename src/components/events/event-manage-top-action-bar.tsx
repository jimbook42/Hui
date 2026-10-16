"use client";

import { useState } from "react";

import { AdminPickTimeForm } from "@/components/events/admin-pick-time-form";
import { AvailabilityNudgeButton } from "@/components/events/availability-nudge-button";
import { CancelEventButton } from "@/components/events/cancel-event-button";
import { DeleteEventForm } from "@/components/events/delete-event-form";
import { ResponseDeadlineManageForm } from "@/components/events/response-deadline-manage-form";
import { RescheduleConfirmedForm } from "@/components/events/reschedule-confirmed-form";

type EventManageTopActionBarProps = {
  eventId: string;
  timeZone: string;
  defaultStartsAt: string | null;
  defaultEndsAt: string | null;
  defaultDeadlineLocal: string;
  lastAvailabilityNudgeAt: string | null;
  canReschedule: boolean;
  canAdminPickTime: boolean;
  adminPickCandidates: { id: string; label: string }[];
  canEditResponseDeadline: boolean;
  canNudgeAvailability: boolean;
  canCancel: boolean;
  canDelete: boolean;
};

type Panel =
  | "none"
  | "respondBy"
  | "pickTime"
  | "reschedule"
  | "reopen"
  | "cancel"
  | "delete";

export function EventManageTopActionBar({
  eventId,
  timeZone,
  defaultStartsAt,
  defaultEndsAt,
  defaultDeadlineLocal,
  lastAvailabilityNudgeAt,
  canReschedule,
  canAdminPickTime,
  adminPickCandidates,
  canEditResponseDeadline,
  canNudgeAvailability,
  canCancel,
  canDelete,
}: EventManageTopActionBarProps) {
  const [panel, setPanel] = useState<Panel>("none");

  if (
    !canReschedule &&
    !canAdminPickTime &&
    !canEditResponseDeadline &&
    !canNudgeAvailability &&
    !canCancel &&
    !canDelete
  ) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canReschedule && defaultStartsAt ? (
          <>
            <button
              type="button"
              className="hui-btn hui-btn-secondary hui-btn-sm min-h-11 rounded-full hui-focus-ring text-sm"
              onClick={() => setPanel(panel === "reschedule" ? "none" : "reschedule")}
            >
              Reschedule
            </button>
            <button
              type="button"
              className="hui-btn hui-btn-secondary hui-btn-sm min-h-11 rounded-full hui-focus-ring text-sm"
              onClick={() => setPanel(panel === "reopen" ? "none" : "reopen")}
            >
              Reopen times
            </button>
          </>
        ) : null}
        {canEditResponseDeadline || canNudgeAvailability ? (
          <button
            type="button"
            className="hui-btn hui-btn-secondary hui-btn-sm min-h-11 rounded-full hui-focus-ring text-sm"
            onClick={() => setPanel(panel === "respondBy" ? "none" : "respondBy")}
          >
            Reply by
          </button>
        ) : null}
        {canAdminPickTime ? (
          <button
            type="button"
            className="hui-btn hui-btn-secondary hui-btn-sm min-h-11 rounded-full hui-focus-ring text-sm"
            onClick={() => setPanel(panel === "pickTime" ? "none" : "pickTime")}
          >
            Pick a different time
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            className="hui-btn hui-btn-secondary hui-btn-sm min-h-11 rounded-full hui-focus-ring text-sm"
            onClick={() => setPanel(panel === "cancel" ? "none" : "cancel")}
          >
            Cancel
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            className="hui-btn hui-btn-danger hui-btn-sm min-h-11 rounded-full hui-focus-ring text-sm"
            onClick={() => setPanel(panel === "delete" ? "none" : "delete")}
          >
            Delete
          </button>
        ) : null}
      </div>

      {panel === "respondBy" && (canEditResponseDeadline || canNudgeAvailability) ? (
        <div className="space-y-4 rounded-hui-lg bg-muted p-4">
          {canEditResponseDeadline ? (
            <ResponseDeadlineManageForm
              eventId={eventId}
              defaultDeadlineLocal={defaultDeadlineLocal}
            />
          ) : null}
          {canNudgeAvailability ? (
            <AvailabilityNudgeButton
              eventId={eventId}
              timeZone={timeZone}
              lastNudgeAt={lastAvailabilityNudgeAt}
            />
          ) : null}
        </div>
      ) : null}
      {panel === "pickTime" && canAdminPickTime ? (
        <div className="rounded-hui-lg bg-muted p-4">
          <AdminPickTimeForm eventId={eventId} candidates={adminPickCandidates} />
        </div>
      ) : null}
      {panel === "reschedule" && canReschedule && defaultStartsAt ? (
        <div className="rounded-hui-lg bg-muted p-4">
          <RescheduleConfirmedForm
            eventId={eventId}
            timeZone={timeZone}
            defaultStartsAt={defaultStartsAt}
            defaultEndsAt={defaultEndsAt}
            mode="reschedule-only"
          />
        </div>
      ) : null}
      {panel === "reopen" && canReschedule && defaultStartsAt ? (
        <div className="rounded-hui-lg bg-muted p-4">
          <RescheduleConfirmedForm
            eventId={eventId}
            timeZone={timeZone}
            defaultStartsAt={defaultStartsAt}
            defaultEndsAt={defaultEndsAt}
            mode="reopen-only"
          />
        </div>
      ) : null}
      {panel === "cancel" && canCancel ? (
        <div className="rounded-hui-lg bg-muted p-4">
          <CancelEventButton eventId={eventId} />
        </div>
      ) : null}
      {panel === "delete" && canDelete ? (
        <div className="rounded-hui-lg bg-muted p-4">
          <DeleteEventForm eventId={eventId} />
        </div>
      ) : null}
    </div>
  );
}
