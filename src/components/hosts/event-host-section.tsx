"use client";

import {
  acceptHostProposalAction,
  assignEventHostAction,
  requestHostSwapAction,
} from "@/app/hosts/actions";
import { AuthForm } from "@/components/auth/auth-form";
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
}: EventHostSectionProps) {
  const assignableMembers = filterHostAssignableMembers(
    eligibleMembers,
    attendanceRoster,
  );
  if (!hostingEnabled) {
    return (
      <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Host</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This group does not use a host for gatherings.
        </p>
      </section>
    );
  }

  if (eventStatus === "cancelled") {
    return (
      <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Host</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This event was cancelled. It does not create a new hosting obligation.
        </p>
        {view.acceptedHost ? (
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
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
    <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Host</h2>

      {coordinating ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Hui suggests a host while the group coordinates attendance. Accepting makes them the
          host for this gathering; a proposal alone does not.
        </p>
      ) : null}

      {viewerHistoryCount !== null && viewerHistoryCount > 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          You have hosted {viewerHistoryCount} confirmed gathering
          {viewerHistoryCount === 1 ? "" : "s"} in this group.
        </p>
      ) : null}

      {view.acceptedHost ? (
        <div className="mt-4">
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
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
        <div className="mt-4 rounded-lg border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
          <p className="text-zinc-800 dark:text-zinc-200">
            Hui has suggested {suggestedName} to host this gathering.
          </p>
          {canRespond || canRequestSwap ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {canRespond ? (
                <AuthForm
                  action={acceptHostProposalAction}
                  submitLabel="I can host"
                  hiddenFields={{ event_id: eventId }}
                  refreshOnSuccess
                >
                  {null}
                </AuthForm>
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
        <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
          No host has been suggested yet.
        </p>
      )}

      {canAssign && !readOnly && !view.acceptedHost ? (
        <div className="mt-6 max-w-md">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Suggest someone else
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
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
      <label className="block text-sm text-zinc-700 dark:text-zinc-300">
        Member
        <select
          name="host_user_id"
          required
          defaultValue={currentHostId ?? ""}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
