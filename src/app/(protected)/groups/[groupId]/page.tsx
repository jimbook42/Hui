import { notFound } from "next/navigation";

import { updateGroupNameAction } from "@/app/groups/actions";
import { AppShell } from "@/components/app/app-shell";
import { GroupForm, GroupNameField } from "@/components/groups/group-form";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import {
  AddMemberForm,
  LeaveGroupForm,
  RemoveMemberButton,
  TransferOwnershipForm,
} from "@/components/groups/member-actions";
import {
  canEditSettings,
  canManageMembers,
  canRenameGroup,
  canTransferOwnership,
} from "@/domain/groups/permissions";
import { getGroupDetail } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

type PageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function GroupDetailPage({ params }: PageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const detail = await getGroupDetail(supabase, groupId, user!.id);
  if (!detail) {
    notFound();
  }

  const viewerCanManage = canManageMembers(detail.viewerRole);
  const viewerCanEditSettings = canEditSettings(detail.viewerRole);
  const viewerCanRename = canRenameGroup(detail.viewerRole);
  const viewerCanTransfer = canTransferOwnership(detail.viewerRole);
  const viewerCanLeave = detail.viewerRole !== "owner";

  return (
    <AppShell title={detail.name}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Your role: <span className="font-medium">{roleLabel(detail.viewerRole)}</span>
      </p>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Members</h2>
        <ul className="mt-4 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {detail.members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {member.displayName}
                  {member.userId === user!.id ? " (you)" : ""}
                </p>
                <p className="text-xs text-zinc-500">{roleLabel(member.role)}</p>
              </div>
              {viewerCanManage &&
              member.userId !== detail.ownerId &&
              member.userId !== user!.id ? (
                <RemoveMemberButton
                  groupId={detail.id}
                  userId={member.userId}
                  displayName={member.displayName}
                />
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {viewerCanManage ? (
        <section className="mt-10">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Add member</h2>
          <div className="mt-4 max-w-md">
            <AddMemberForm groupId={detail.id} />
          </div>
        </section>
      ) : null}

      {viewerCanRename ? (
        <section className="mt-10">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Group name</h2>
          <div className="mt-4 max-w-md">
            <GroupForm
              action={updateGroupNameAction}
              submitLabel="Save name"
              hiddenFields={{ group_id: detail.id }}
            >
              <GroupNameField defaultValue={detail.name} />
            </GroupForm>
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Settings</h2>
        {viewerCanEditSettings ? (
          <div className="mt-4 max-w-lg">
            <GroupSettingsForm groupId={detail.id} settings={detail.settings} />
          </div>
        ) : (
          <dl className="mt-4 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <div>
              <dt className="text-zinc-500">Who may propose</dt>
              <dd>{detail.settings.whoMayPropose}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Minimum attendees</dt>
              <dd>{detail.settings.minimumAttendees}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Maybe responses</dt>
              <dd>{detail.settings.maybeResponsesEnabled ? "Enabled" : "Disabled"}</dd>
            </div>
          </dl>
        )}
      </section>

      {viewerCanTransfer ? (
        <section className="mt-10">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Transfer ownership
          </h2>
          <div className="mt-4 max-w-md">
            <TransferOwnershipForm
              groupId={detail.id}
              members={detail.members}
              ownerId={detail.ownerId}
            />
          </div>
        </section>
      ) : null}

      {viewerCanLeave ? (
        <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Leave group</h2>
          <div className="mt-4 max-w-md">
            <LeaveGroupForm groupId={detail.id} />
          </div>
        </section>
      ) : (
        <p className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
          As owner, transfer ownership before you can leave this group.
        </p>
      )}
    </AppShell>
  );
}
