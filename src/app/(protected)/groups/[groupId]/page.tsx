import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { updateGroupNameAction } from "@/app/groups/actions";
import { AppShell } from "@/components/app/app-shell";
import { ContributionCategoriesAdmin } from "@/components/contributions/contribution-categories-admin";
import { GroupContributionHistorySection } from "@/components/contributions/group-contribution-history";
import { GroupDietarySection } from "@/components/dietary/group-dietary-section";
import {
  GroupUpcoming,
  GroupUpcomingSkeleton,
} from "@/components/groups/group-detail-sections";
import { GroupForm, GroupNameField } from "@/components/groups/group-form";
import { GroupInviteSection } from "@/components/groups/group-invite-section";
import { GroupMemberCoordination } from "@/components/groups/group-member-coordination";
import { GroupMembersHouseholds } from "@/components/groups/group-members-households";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import {
  AddMemberForm,
  LeaveGroupForm,
  RemoveMemberButton,
  TransferOwnershipForm,
} from "@/components/groups/member-actions";
import { GroupHostHistorySection } from "@/components/hosts/group-host-history";
import { AvatarStack } from "@/components/hui/avatar-stack";
import { DisclosureCard } from "@/components/hui/disclosure-card";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import {
  BowlIcon,
  CalendarIcon,
  LeafIcon,
  PeopleIcon,
  PlusIcon,
  SparkIcon,
  UserIcon,
} from "@/components/hui/icons";
import { SectionHeader } from "@/components/hui/section-header";
import { StatusPill } from "@/components/hui/status-pill";
import { canManageContributionCategories } from "@/domain/contributions/permissions";
import { canProposeEvents, groupAllowsEventKind } from "@/domain/events/permissions";
import { DeleteGroupForm } from "@/components/groups/delete-group-form";
import {
  canDeleteGroup,
  canEditSettings,
  canManageMembers,
  canRenameGroup,
  canTransferOwnership,
} from "@/domain/groups/permissions";
import { resolveAuthRedirectOrigin } from "@/lib/auth/app-origin";
import { getGroupContributionHistory, listContributionCategories } from "@/lib/contributions/queries";
import { listGroupSharedDietary } from "@/lib/dietary/queries";
import { getGroupDetail } from "@/lib/groups/queries";
import { getGroupHostHistory } from "@/lib/hosts/queries";
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
  const viewerCanDelete = canDeleteGroup(detail.viewerRole);
  const viewerCanLeave = detail.viewerRole !== "owner";
  const viewerCanPropose =
    canProposeEvents(detail.viewerRole, detail.settings) &&
    (groupAllowsEventKind("one_off", detail.settings) ||
      groupAllowsEventKind("recurring", detail.settings));
  const [householdView, contributionCategories, contributionHistory, hostHistory, sharedDietary] =
    await Promise.all([
      getGroupHouseholdMemberView(supabase, groupId, detail.members),
      listContributionCategories(supabase, groupId),
      getGroupContributionHistory(supabase, groupId, user!.id),
      getGroupHostHistory(supabase, groupId, user!.id),
      listGroupSharedDietary(supabase, groupId),
    ]);
  const viewerCanManageCategories = canManageContributionCategories(detail.viewerRole);

  let inviteToken: string | null = null;
  if (viewerCanManage) {
    const { data: tokenData, error: inviteError } = await supabase.rpc("get_group_invite_link", {
      p_group_id: groupId,
    });
    if (!inviteError && typeof tokenData === "string") {
      inviteToken = tokenData;
    }
  }
  const appOrigin = await resolveAuthRedirectOrigin();

  const memberCount = detail.members.length;
  const removable = detail.members.filter(
    (member) => member.userId !== detail.ownerId && member.userId !== user!.id,
  );

  return (
    <AppShell title={detail.name} hideTitle back={{ href: "/groups", label: "Groups" }}>
      <div className="space-y-6">
        <HuiSurface
          tone="primary"
          shape="organic"
          padding="lg"
          elevated
          className="hui-rise overflow-hidden"
        >
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="hui-shape-blob-a flex h-16 w-16 shrink-0 items-center justify-center bg-[var(--accent-clay)] text-2xl font-black text-[#1a4331]"
            >
              {detail.name.trim().charAt(0).toUpperCase() || "G"}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="hui-type-display break-words text-primary-foreground">{detail.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill label={roleLabel(detail.viewerRole)} tone="clay" />
                <span className="text-sm font-bold opacity-90">
                  {memberCount} {memberCount === 1 ? "member" : "members"}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <AvatarStack
              people={detail.members.map((member) => ({ id: member.userId, name: member.displayName }))}
              max={7}
              size="md"
              label={`${memberCount} ${memberCount === 1 ? "member" : "members"}`}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {viewerCanPropose ? (
              <HuiLinkButton
                href={`/groups/${groupId}/events/new`}
                variant="secondary"
                shape="melt"
              >
                <PlusIcon size={18} />
                Propose a hui
              </HuiLinkButton>
            ) : null}
            <HuiLinkButton
              href={`/groups/${groupId}/events`}
              variant="ghost"
              className="!text-primary-foreground hover:!bg-white/10"
            >
              <CalendarIcon size={18} />
              All events
            </HuiLinkButton>
          </div>
        </HuiSurface>

        <Suspense fallback={<GroupUpcomingSkeleton />}>
          <GroupUpcoming groupId={groupId} />
        </Suspense>

        <HuiSurface padding="lg" shape="organic-alt" elevated className="hui-rise-3">
          <SectionHeader
            title="People"
            description="Listed by household where one is set."
          />
          <div className="mt-4">
            <GroupMembersHouseholds
              view={householdView}
              members={detail.members}
              currentUserId={user!.id}
            />
          </div>
          <p className="hui-type-supporting mt-5">
            Manage your own household from{" "}
            <Link href="/profile" className="hui-link">
              your profile
            </Link>
            .
          </p>
        </HuiSurface>

        <section aria-labelledby="group-more" className="space-y-3">
          <SectionHeader
            id="group-more"
            title="More"
            description="Preferences, history and admin tools."
          />

          <DisclosureCard
            title="Hosting and consensus"
            summary="Your hosting preference"
            icon={<UserIcon size={20} />}
          >
            <GroupMemberCoordination
              groupId={detail.id}
              settings={detail.settings}
              members={detail.members}
              viewerUserId={user!.id}
              canManageMembers={viewerCanManage}
            />
          </DisclosureCard>

          <DisclosureCard
            title="Dietary needs"
            summary={
              sharedDietary.length === 0 ? "Nothing shared yet" : `${sharedDietary.length} shared`
            }
            icon={<LeafIcon size={20} />}
          >
            <GroupDietarySection rows={sharedDietary} />
          </DisclosureCard>

          <DisclosureCard
            title="History"
            summary="Who has hosted and brought things"
            icon={<BowlIcon size={20} />}
          >
            <div className="space-y-8">
              <GroupContributionHistorySection history={contributionHistory} />
              <GroupHostHistorySection history={hostHistory} />
            </div>
          </DisclosureCard>

          {viewerCanManage && inviteToken ? (
            <DisclosureCard
              title="Invite people"
              summary="Share the invite link"
              icon={<PeopleIcon size={20} />}
            >
              <div className="space-y-8">
                <GroupInviteSection
                  groupId={detail.id}
                  inviteToken={inviteToken}
                  appOrigin={appOrigin}
                />
                <div className="max-w-md">
                  <h3 className="hui-type-section text-foreground">Add by member ID</h3>
                  <div className="mt-3">
                    <AddMemberForm groupId={detail.id} />
                  </div>
                </div>
              </div>
            </DisclosureCard>
          ) : null}

          {viewerCanManage && removable.length > 0 ? (
            <DisclosureCard
              title="Remove members"
              summary="Admins only"
              icon={<PeopleIcon size={20} />}
            >
              <ul className="space-y-2 text-sm">
                {removable.map((member) => (
                  <li key={member.userId} className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
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
            </DisclosureCard>
          ) : null}

          {viewerCanManageCategories ? (
            <DisclosureCard
              title="Contribution categories"
              summary="What people can bring"
              icon={<BowlIcon size={20} />}
            >
              <p className="hui-type-supporting mb-4">
                Categories members can claim on events. Deactivating keeps past event records intact.
              </p>
              <div className="max-w-lg">
                <ContributionCategoriesAdmin
                  groupId={detail.id}
                  categories={contributionCategories}
                  members={detail.members.map((member) => ({
                    userId: member.userId,
                    displayName: member.displayName,
                  }))}
                />
              </div>
            </DisclosureCard>
          ) : null}

          <DisclosureCard
            title="Group settings"
            summary={viewerCanEditSettings ? "Rules for proposing and agreeing" : "How this group decides"}
            icon={<SparkIcon size={20} />}
          >
            {viewerCanEditSettings ? (
              <div className="max-w-lg">
                <GroupSettingsForm groupId={detail.id} settings={detail.settings} />
              </div>
            ) : (
              <dl className="grid gap-4 text-sm text-foreground">
                <div>
                  <dt className="hui-type-label text-muted-foreground">Who may propose</dt>
                  <dd className="mt-1 font-extrabold">{detail.settings.whoMayPropose}</dd>
                </div>
                <div>
                  <dt className="hui-type-label text-muted-foreground">Minimum attendees</dt>
                  <dd className="mt-1 font-extrabold">{detail.settings.minimumAttendees}</dd>
                </div>
                <div>
                  <dt className="hui-type-label text-muted-foreground">Maybe responses</dt>
                  <dd className="mt-1 font-extrabold">
                    {detail.settings.maybeResponsesEnabled ? "Enabled" : "Disabled"}
                  </dd>
                </div>
              </dl>
            )}
          </DisclosureCard>

          {viewerCanRename ? (
            <DisclosureCard title="Group name" summary={detail.name} icon={<SparkIcon size={20} />}>
              <div className="max-w-md">
                <GroupForm
                  action={updateGroupNameAction}
                  submitLabel="Save name"
                  hiddenFields={{ group_id: detail.id }}
                >
                  <GroupNameField defaultValue={detail.name} />
                </GroupForm>
              </div>
            </DisclosureCard>
          ) : null}

          {viewerCanTransfer ? (
            <DisclosureCard
              title="Transfer ownership"
              summary="Hand the group to someone else"
              icon={<UserIcon size={20} />}
            >
              <div className="max-w-md">
                <p className="hui-type-supporting mb-4">
                  Transfers group admin rights only. Accepted hosting on existing events stays with
                  whoever already accepted.
                </p>
                <TransferOwnershipForm
                  groupId={detail.id}
                  members={detail.members}
                  ownerId={detail.ownerId}
                />
              </div>
            </DisclosureCard>
          ) : null}

          {viewerCanDelete ? (
            <DisclosureCard
              title="Delete group"
              summary="Permanently remove this group"
              icon={<SparkIcon size={20} />}
            >
              <div className="max-w-md">
                <DeleteGroupForm groupId={detail.id} groupName={detail.name} />
              </div>
            </DisclosureCard>
          ) : null}

          {viewerCanLeave ? (
            <DisclosureCard title="Leave group" summary="You can rejoin by invite" icon={<UserIcon size={20} />}>
              <div className="max-w-md">
                <LeaveGroupForm groupId={detail.id} />
              </div>
            </DisclosureCard>
          ) : (
            <p className="hui-type-supporting px-2">
              As owner, transfer ownership before you can leave this group.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
