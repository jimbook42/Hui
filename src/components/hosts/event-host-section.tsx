"use client";

import {
  acceptHostProposalAction,
  assignEventHostAction,
  assignSuggestedHostAction,
  declineHostProposalAction,
} from "@/app/hosts/actions";
import { AuthForm } from "@/components/auth/auth-form";
import type { EventHostView } from "@/lib/hosts/queries";
import type { GroupMemberRow } from "@/lib/groups/types";

type EventHostSectionProps = {
  eventId: string;
  groupId: string;
  eventStatus: string;
  hostVetoEnabled: boolean;
  canAssign: boolean;
  canRespond: boolean;
  eligibleMembers: GroupMemberRow[];
  view: EventHostView;
  viewerHistoryCount: number | null;
};

export function EventHostSection({
  eventId,
  groupId,
  eventStatus,
  hostVetoEnabled,
  canAssign,
  canRespond,
  eligibleMembers,
  view,
  viewerHistoryCount,
}: EventHostSectionProps) {
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

  if (eventStatus !== "confirmed" && eventStatus !== "completed") {
    return null;
  }

  const readOnly = eventStatus === "completed";

  return (
    <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Host</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Hui suggests fairly based on who has hosted confirmed gatherings in this group. The group
        chooses who hosts — nothing is assigned without your agreement.
      </p>

      {viewerHistoryCount !== null && viewerHistoryCount > 0 ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          You have hosted {viewerHistoryCount} confirmed gathering
          {viewerHistoryCount === 1 ? "" : "s"} in this group.
        </p>
      ) : null}

      {view.acceptedHost ? (
        <p className="mt-4 text-sm text-zinc-800 dark:text-zinc-200">
          <span className="font-medium">Host:</span> {view.acceptedHost.displayName}
        </p>
      ) : (
        <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">No host selected yet.</p>
      )}

      {view.pendingProposal ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">Waiting for agreement</p>
          <p className="mt-1">
            {view.pendingProposal.displayName} has been asked to host
            {hostVetoEnabled ? " and must accept before it is final." : "."}
          </p>
          {canRespond ? (
            <div className="mt-3 flex flex-wrap gap-3">
              <AuthForm
                action={acceptHostProposalAction}
                submitLabel="Accept hosting"
                hiddenFields={{ event_id: eventId }}
                refreshOnSuccess
              >
                {null}
              </AuthForm>
              <AuthForm
                action={declineHostProposalAction}
                submitLabel="Decline"
                hiddenFields={{ event_id: eventId }}
                refreshOnSuccess
              >
                {null}
              </AuthForm>
            </div>
          ) : null}
        </div>
      ) : null}

      {view.suggestion && !readOnly ? (
        <div className="mt-4 rounded-lg border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Suggested next host</p>
          <p className="mt-1 text-zinc-700 dark:text-zinc-300">{view.suggestion.reason}</p>
          {canAssign ? (
            <div className="mt-3">
              <AuthForm
                action={assignSuggestedHostAction}
                submitLabel={`Ask ${view.suggestion.displayName} to host`}
                hiddenFields={{
                  event_id: eventId,
                  group_id: groupId,
                  host_user_id: view.suggestion.userId,
                }}
                refreshOnSuccess
              >
                {null}
              </AuthForm>
            </div>
          ) : null}
        </div>
      ) : null}

      {canAssign && !readOnly ? (
        <div className="mt-6 max-w-md">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Choose a host</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Event proposers and group admins can select or change the host.
          </p>
          <AssignHostForm
            eventId={eventId}
            groupId={groupId}
            members={eligibleMembers}
            currentHostId={view.acceptedHost?.userId ?? view.pendingProposal?.userId ?? null}
          />
        </div>
      ) : null}

      {readOnly && !view.acceptedHost ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          This event is complete. Host selection is read-only.
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
  members: GroupMemberRow[];
  currentHostId: string | null;
}) {
  return (
    <AuthForm
      action={assignEventHostAction}
      submitLabel="Set host"
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
