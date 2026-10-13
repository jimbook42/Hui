"use client";

import { useActionState } from "react";

import type { GroupActionState } from "@/app/groups/actions";
import {
  addGroupMemberAction,
  leaveGroupAction,
  removeGroupMemberAction,
  transferOwnershipAction,
} from "@/app/groups/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";

import type { GroupMemberRow } from "@/lib/groups/types";

const initialState: GroupActionState = {};

export function AddMemberForm({ groupId }: { groupId: string }) {
  return (
    <AuthForm
      action={addGroupMemberAction}
      submitLabel="Add member"
      hiddenFields={{ group_id: groupId }}
    >
      <AuthField
        label="Member user ID"
        name="user_id"
        autoComplete="off"
        required
      />
      <p className="text-xs text-muted-foreground">
        Ask them to copy their member ID from their profile page. Email invitations
        are not implemented yet.
      </p>
    </AuthForm>
  );
}

export function RemoveMemberButton({
  groupId,
  userId,
  displayName,
}: {
  groupId: string;
  userId: string;
  displayName: string;
}) {
  const [state, formAction, pending] = useActionState(removeGroupMemberAction, initialState);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="user_id" value={userId} />
      {state.error ? (
        <p className="hui-message-error" role="alert">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="hui-link-danger text-sm"
      >
        Remove {displayName}
      </button>
    </form>
  );
}

export function TransferOwnershipForm({
  groupId,
  members,
  ownerId,
}: {
  groupId: string;
  members: GroupMemberRow[];
  ownerId: string;
}) {
  const candidates = members.filter(
    (member) => member.userId !== ownerId && member.role !== "owner",
  );

  return (
    <AuthForm
      action={transferOwnershipAction}
      submitLabel="Transfer ownership"
      hiddenFields={{ group_id: groupId }}
    >
      <label className="hui-label">
        <span>New owner</span>
        <select
          name="new_owner_id"
          required
          className="hui-input"
        >
          <option value="">Select a member</option>
          {candidates.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.displayName} ({member.role})
            </option>
          ))}
        </select>
      </label>
    </AuthForm>
  );
}

export function LeaveGroupForm({ groupId }: { groupId: string }) {
  return (
    <AuthForm action={leaveGroupAction} submitLabel="Leave group" hiddenFields={{ group_id: groupId }}>
      <p className="text-sm text-muted-foreground">
        You will lose access to this group&apos;s current data. Historical records
        stay intact for remaining members.
      </p>
    </AuthForm>
  );
}
