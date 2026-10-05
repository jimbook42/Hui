"use client";

import {
  acceptHostProposalAction,
  assignEventHostAction,
  requestHostSwapAction,
} from "@/app/hosts/actions";
import { AcceptHostWithPlaceForm } from "@/components/hosts/accept-host-with-place-form";
import { AuthForm } from "@/components/auth/auth-form";
import type { EventCoordinates } from "@/domain/events/location";
import type { ProfileHomeLocation } from "@/domain/profile/home-location";
import { filterHostAssignableMembers } from "@/domain/hosts/attendance-eligibility";
import type { AttendanceRoster } from "@/domain/scheduling/attendance-roster";
import type { EventHostView } from "@/lib/hosts/queries";
import type { GroupMemberRow } from "@/lib/groups/types";

type EventHostSectionProps = {
  eventId: string;
  groupId: string;
  eventStatus: string;
  hostingEnabled: boolean;
  canAssign: boolean;
  canRespond: boolean;
  canRequestSwap: boolean;
  viewerUserId: string;
  eligibleMembers: GroupMemberRow[];
  attendanceRoster: AttendanceRoster | null;
  view: EventHostView;
  viewerHistoryCount: number | null;
  eventLocation: string | null;
  eventCoordinates: EventCoordinates | null;
  hostPlaceRequired: boolean | null;
  viewerHomeLocation: ProfileHomeLocation | null;
};

export function EventHostSection({
  eventId,
  groupId,
  eventStatus,
  hostingEnabled,
  canAssign,
  canRespond,
  canRequestSwap,
  viewerUserId,
  eligibleMembers,
  attendanceRoster,
  view,
  viewerHistoryCount,
  eventLocation,
  eventCoordinates,
  hostPlaceRequired,
  viewerHomeLocation,
}: EventHostSectionProps) {
  const assignableMembers = filterHostAssignableMembers(
    eligibleMembers,
    attendanceRoster,
  );
  if (!hostingEnabled) {
    return (
      <section id="host" className="hui-card-section">
        <h2 className="hui-type-section text-foreground">Host</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This group does not use a host for gatherings.
        </p>
      </section>
    );
  }

  if (eventStatus === "cancelled") {
    return (
      <section id="host" className="hui-card-section">
        <h2 className="hui-type-section text-foreground">Host</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This event was cancelled. It does not create a new hosting obligation.
        </p>
        {view.acceptedHost ? (
          <p className="mt-2 text-sm text-foreground">
            Recorded host before cancellation: {view.acceptedHost.displayName}
          </p>
        ) : null}
      </section>
    );
  }

  if (
    eventStatus !== "proposing" &&
    eventStatus !== "confirmed" &&
    eventStatus !== "completed"
  ) {
    return null;
  }

  const readOnly = eventStatus === "completed";
  const coordinating = eventStatus === "proposing";
  const suggestedName = view.pendingProposal?.displayName ?? null;

  return (
    <section id="host" className="hui-card-section">
      <h2 className="hui-type-section text-foreground">Host</h2>

      {coordinating ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Hui suggests a host while the group coordinates attendance. Accepting makes them the
          host for this gathering; a proposal alone does not.
        </p>
      ) : null}

      {viewerHistoryCount !== null && viewerHistoryCount > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          You have hosted {viewerHistoryCount} confirmed gathering
          {viewerHistoryCount === 1 ? "" : "s"} in this group.
        </p>
      ) : null}

      {view.acceptedHost ? (
        <div className="mt-4">
          <p className="text-sm text-foreground">
            <span className="font-medium">{view.acceptedHost.displayName}</span> is hosting.
          </p>
          {canRequestSwap && view.acceptedHost.userId === viewerUserId && !readOnly ? (
            <div className="mt-3">
              <AuthForm
                action={requestHostSwapAction}
                submitLabel="Ask to swap"
                hiddenFields={{ event_id: eventId }}
                refreshOnSuccess
              >
                {null}
              </AuthForm>
            </div>
          ) : null}
        </div>
      ) : suggestedName ? (
        <div className="mt-4 rounded-hui-md px-4 py-3 text-sm bg-muted">
          <p className="text-foreground">
            Hui has suggested {suggestedName} to host this gathering.
          </p>
          {canRespond || canRequestSwap ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {canRespond ? (
                <AcceptHostWithPlaceForm
                  action={acceptHostProposalAction}
                  eventId={eventId}
                  hostingEnabled={hostingEnabled}
                  hostPlaceRequired={hostPlaceRequired}
                  defaultLocation={eventLocation}
                  defaultCoordinates={eventCoordinates}
                  suggestedHostName={suggestedName ?? "You"}
                  viewerHomeLocation={viewerHomeLocation}
                />
              ) : null}
              {canRequestSwap ? (
                <AuthForm
                  action={requestHostSwapAction}
                  submitLabel="Ask to swap"
                  hiddenFields={{ event_id: eventId }}
                  refreshOnSuccess
                >
                  {null}
                </AuthForm>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-foreground">
          No host has been suggested yet.
        </p>
      )}

      {canAssign && !readOnly && !view.acceptedHost ? (
        <div className="mt-6 max-w-md">
          <h3 className="text-sm font-bold text-foreground">
            Suggest someone else
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Event proposers and group admins can suggest a different host. They still need to
            accept.
          </p>
          <AssignHostForm
            eventId={eventId}
            groupId={groupId}
            members={assignableMembers}
            currentHostId={view.pendingProposal?.userId ?? null}
          />
        </div>
      ) : null}

      {readOnly && !view.acceptedHost ? (
        <p className="mt-4 text-sm text-muted-foreground">
          This event is complete. Host details are read-only.
        </p>
      ) : null}
    </section>
  );
}

function AssignHostForm({
  eventId,
  groupId,
  members,
  currentHostId,
}: {
  eventId: string;
  groupId: string;
  members: Pick<GroupMemberRow, "userId" | "displayName">[];
  currentHostId: string | null;
}) {
  return (
    <AuthForm
      action={assignEventHostAction}
      submitLabel="Suggest host"
      hiddenFields={{ event_id: eventId, group_id: groupId }}
      refreshOnSuccess
    >
      <label className="hui-label">
        Member
        <select
          name="host_user_id"
          required
          defaultValue={currentHostId ?? ""}
          className="hui-input"
        >
          <option value="" disabled>
            Select a member
          </option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.displayName}
            </option>
          ))}
        </select>
      </label>
    </AuthForm>
  );
}
