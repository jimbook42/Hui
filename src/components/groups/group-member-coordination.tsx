"use client";

import {
  setMemberConsensusRequiredAction,
  setMyHostingStandingAction,
} from "@/app/groups/actions";
import { AuthForm } from "@/components/auth/auth-form";
import type { GroupMemberRow, GroupSettingsRow, MemberHostingStanding } from "@/lib/groups/types";

type GroupMemberCoordinationProps = {
  groupId: string;
  settings: GroupSettingsRow;
  members: GroupMemberRow[];
  viewerUserId: string;
  canManageMembers: boolean;
};

const hostingOptions: { value: MemberHostingStanding; label: string }[] = [
  { value: "default", label: "Happy to host sometimes" },
  { value: "prefer_not", label: "I'd rather not host" },
  { value: "never", label: "I don't host" },
];

export function GroupMemberCoordination({
  groupId,
  settings,
  members,
  viewerUserId,
  canManageMembers,
}: GroupMemberCoordinationProps) {
  const viewer = members.find((member) => member.userId === viewerUserId);

  return (
    <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Hosting and consensus
      </h2>

      {viewer ? (
        <div className="mt-4 max-w-md">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Your hosting</h3>
          <AuthForm
            action={setMyHostingStandingAction}
            submitLabel="Save hosting preference"
            hiddenFields={{ group_id: groupId }}
            refreshOnSuccess
          >
            <label className="mt-2 block text-sm text-zinc-700 dark:text-zinc-300">
              <span>Hosting preference</span>
              <select
                name="hosting_standing"
                defaultValue={viewer.hostingStanding}
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {hostingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </AuthForm>
        </div>
      ) : null}

      {settings.consensusRule === "required_participants" && canManageMembers ? (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Required for consensus
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Mark members who must be available before this group can confirm a time.
          </p>
          <ul className="mt-4 space-y-3">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-zinc-800 dark:text-zinc-200">{member.displayName}</span>
                <AuthForm
                  action={setMemberConsensusRequiredAction}
                  submitLabel={member.consensusRequired ? "Required" : "Not required"}
                  hiddenFields={{
                    group_id: groupId,
                    user_id: member.userId,
                    required: member.consensusRequired ? "off" : "on",
                  }}
                  refreshOnSuccess
                >
                  {null}
                </AuthForm>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
