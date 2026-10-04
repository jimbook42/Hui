"use client";

import {
  setMemberConsensusRequiredAction,
  setMyHostingStandingAction,
} from "@/app/groups/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { hostingOptions } from "@/lib/groups/hosting-options";
import type { GroupMemberRow, GroupSettingsRow } from "@/lib/groups/types";

type GroupMemberCoordinationProps = {
  groupId: string;
  settings: GroupSettingsRow;
  members: GroupMemberRow[];
  viewerUserId: string;
  canManageMembers: boolean;
};


export function GroupMemberCoordination({
  groupId,
  settings,
  members,
  viewerUserId,
  canManageMembers,
}: GroupMemberCoordinationProps) {
  const viewer = members.find((member) => member.userId === viewerUserId);

  return (
    <section className="hui-card-section">
      <h2 className="hui-type-section text-foreground">
        Hosting and consensus
      </h2>

      {viewer ? (
        <div className="mt-4 max-w-md">
          <h3 className="text-sm font-bold text-foreground">Your hosting</h3>
          <AuthForm
            action={setMyHostingStandingAction}
            submitLabel="Save hosting preference"
            hiddenFields={{ group_id: groupId }}
            refreshOnSuccess
          >
            <label className="mt-2 block text-sm text-foreground">
              <span>Hosting preference</span>
              <select
                name="hosting_standing"
                defaultValue={viewer.hostingStanding}
                className="hui-input"
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
          <h3 className="text-sm font-bold text-foreground">
            Required for consensus
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mark members who must be available before this group can confirm a time.
          </p>
          <ul className="mt-4 space-y-3">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-foreground">{member.displayName}</span>
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
