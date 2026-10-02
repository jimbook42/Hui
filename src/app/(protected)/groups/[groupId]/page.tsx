import Link from "next/link";
import { notFound } from "next/navigation";

import { updateGroupNameAction } from "@/app/groups/actions";
import { AppShell } from "@/components/app/app-shell";
import { GroupForm, GroupNameField } from "@/components/groups/group-form";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import { ContributionCategoriesAdmin } from "@/components/contributions/contribution-categories-admin";
import { GroupContributionHistorySection } from "@/components/contributions/group-contribution-history";
import { GroupHostHistorySection } from "@/components/hosts/group-host-history";
import { GroupDietarySection } from "@/components/dietary/group-dietary-section";
import { GroupMemberCoordination } from "@/components/groups/group-member-coordination";
import { GroupMembersHouseholds } from "@/components/groups/group-members-households";
import { listGroupSharedDietary } from "@/lib/dietary/queries";
import { canManageContributionCategories } from "@/domain/contributions/permissions";
import { listContributionCategories, getGroupContributionHistory } from "@/lib/contributions/queries";
import { getGroupHostHistory } from "@/lib/hosts/queries";
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
import { getGroupHouseholdMemberView } from "@/lib/households/queries";
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
  const [householdView, contributionCategories, contributionHistory, hostHistory, sharedDietary] =
    await Promise.all([
      getGroupHouseholdMemberView(supabase, groupId, detail.members),
      listContributionCategories(supabase, groupId),
      getGroupContributionHistory(supabase, groupId, user!.id),
      getGroupHostHistory(supabase, groupId, user!.id),
      listGroupSharedDietary(supabase, groupId),
    ]);
  const viewerCanManageCategories = canManageContributionCategories(detail.viewerRole);

  return (
    <AppShell title={detail.name}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Your role: <span className="font-medium">{roleLabel(detail.viewerRole)}</span>
      </p>

      <p className="mt-4 text-sm">
        <Link
          href={`/groups/${groupId}/events`}
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
        >
          View events
        </Link>
      </p>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Members</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Group members are listed by household where set. Manage your household from{" "}
          <Link
            href="/profile"
            className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            account settings
          </Link>
          .
        </p>
        <div className="mt-4">
          <GroupMembersHouseholds
            view={householdView}
            members={detail.members}
            currentUserId={user!.id}
          />
        </div>
        {viewerCanManage ? (
          <ul className="mt-6 space-y-2 text-sm">
            {detail.members
              .filter(
                (member) =>
                  member.userId !== detail.ownerId && member.userId !== user!.id,
              )
              .map((member) => (
                <li key={member.userId} className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-700 dark:text-zinc-300">
                    Remove {member.displayName} from group:
                  </span>
                  <RemoveMemberButton
                    groupId={detail.id}
                    userId={member.userId}
                    displayName={member.displayName}
                  />
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      <GroupMemberCoordination
        groupId={detail.id}
        settings={detail.settings}
        members={detail.members}
        viewerUserId={user!.id}
        canManageMembers={viewerCanManage}
      />

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

      {viewerCanManageCategories ? (
        <section className="mt-10">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Contribution categories
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Categories members can claim on events. Deactivating keeps past event records intact.
          </p>
          <div className="mt-4 max-w-lg">
            <ContributionCategoriesAdmin groupId={detail.id} categories={contributionCategories} />
          </div>
        </section>
      ) : null}

      <GroupDietarySection rows={sharedDietary} />

      <GroupContributionHistorySection history={contributionHistory} />

      <GroupHostHistorySection history={hostHistory} />

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
