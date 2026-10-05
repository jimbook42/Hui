"use client";

import {
  assignContributionAsManagerAction,
  claimContributionAction,
  reassignContributionAsManagerAction,
  releaseContributionAction,
  releaseContributionAsManagerAction,
  updateContributionAction,
} from "@/app/contributions/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { HuiSurface } from "@/components/hui/hui-surface";
import { BowlIcon } from "@/components/hui/icons";
import { buildContributionBoard } from "@/domain/contributions/display";
import { buildContributionSlots, type ContributionSlot } from "@/domain/contributions/slots";
import { sharedDietaryReminder } from "@/domain/dietary/display";
import type { ContributionCategoryRow, EventContributionRow } from "@/lib/contributions/types";

type ContributionMember = {
  userId: string;
  displayName: string;
};

type EventContributionsSectionProps = {
  eventId: string;
  groupId: string;
  eventStatus: string;
  canCoordinate: boolean;
  canAssign: boolean;
  isProposed: boolean;
  categories: ContributionCategoryRow[];
  contributions: EventContributionRow[];
  viewerUserId: string;
  acceptedHostUserId: string | null;
  members: ContributionMember[];
  viewerHistoryCount: number | null;
  sharedDietaryCount: number;
};

export function EventContributionsSection({
  eventId,
  groupId,
  eventStatus,
  canCoordinate,
  canAssign,
  isProposed,
  categories,
  contributions,
  viewerUserId,
  acceptedHostUserId,
  members,
  viewerHistoryCount,
  sharedDietaryCount,
}: EventContributionsSectionProps) {
  const slots = buildContributionSlots(
    categories,
    contributions,
    viewerUserId,
    acceptedHostUserId,
  );
  const board = buildContributionBoard(
    categories,
    contributions,
    viewerUserId,
    acceptedHostUserId,
  );
  const hasActiveCategories = categories.some((c) => c.archivedAt === null);
  const dietaryReminder = sharedDietaryReminder(sharedDietaryCount);
  const openCount = slots.filter((slot) => slot.state === "open").length;

  if (eventStatus === "cancelled") {
    return (
      <section id="contributions" className="hui-card-section">
        <h2 className="hui-type-section text-foreground">Contributions</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This event was cancelled. Contribution coordination is closed.
        </p>
        {board.claimed.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {board.claimed.map((c) => (
              <li key={c.id} className="text-sm text-foreground">
                {c.categoryName ?? "Contribution"} — {c.displayName ?? "Member"}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }

  return (
    <section id="contributions" className="hui-card-section">
      <h2 className="hui-type-section text-foreground">Contributions</h2>
      {isProposed ? (
        <p className="hui-message-note mt-2">
          This event is not confirmed yet. Claims help the group coordinate, but plans may still change.
        </p>
      ) : null}
      {!hasActiveCategories ? (
        <p className="mt-2 text-sm text-muted-foreground">
          This group has no contribution categories yet. Group admins can add categories from the group
          page.
        </p>
      ) : null}

      {hasActiveCategories ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {openCount > 0
            ? `${openCount} still open · ${board.claimed.length} claimed`
            : "Every category has someone bringing it."}
        </p>
      ) : null}

      {viewerHistoryCount !== null && viewerHistoryCount > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ve contributed {viewerHistoryCount} time{viewerHistoryCount === 1 ? "" : "s"} across
          recent confirmed events in this group.
        </p>
      ) : null}

      {dietaryReminder ? (
        <p className="mt-2 text-sm text-muted-foreground">{dietaryReminder}</p>
      ) : null}

      {hasActiveCategories ? (
        <ul className="mt-6 space-y-3">
          {slots.map((slot) => (
            <ContributionSlotCard
              key={slot.category.id}
              slot={slot}
              eventId={eventId}
              groupId={groupId}
              canCoordinate={canCoordinate}
              canAssign={canAssign}
              members={members}
            />
          ))}
        </ul>
      ) : null}

      {!canCoordinate && board.claimed.length > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          This event is complete. Contribution claims are read-only.
        </p>
      ) : null}
    </section>
  );
}

function ContributionSlotCard({
  slot,
  eventId,
  groupId,
  canCoordinate,
  canAssign,
  members,
}: {
  slot: ContributionSlot;
  eventId: string;
  groupId: string;
  canCoordinate: boolean;
  canAssign: boolean;
  members: ContributionMember[];
}) {
  const { category, contribution, state, statusLabel } = slot;
  const isMine = state === "yours" || (state === "host" && contribution?.userId !== null);
  const tone = isMine ? "sage" : state === "open" ? "default" : "subtle";

  return (
    <li>
      <HuiSurface tone={tone} shape="soft" padding="md">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <BowlIcon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-foreground">{category.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{statusLabel}</p>
            {contribution && contribution.label.toLowerCase() !== category.name.toLowerCase() ? (
              <p className="mt-1 text-sm text-foreground">{contribution.label}</p>
            ) : null}
          </div>
        </div>

        {state === "open" && canCoordinate && !category.followsHost ? (
          <div className="mt-3">
            <ClaimForm eventId={eventId} groupId={groupId} category={category} />
          </div>
        ) : null}

        {state === "open" && canAssign && !category.followsHost ? (
          <div className="mt-3 border-t border-border/50 pt-3">
            <AssignContributionForm
              eventId={eventId}
              groupId={groupId}
              category={category}
              members={members}
              submitLabel="Assign member"
            />
          </div>
        ) : null}

        {isMine && contribution && canCoordinate && !category.followsHost ? (
          <div className="mt-3 border-t border-border/50 pt-3">
            <ManageContributionForm eventId={eventId} contribution={contribution} />
          </div>
        ) : null}

        {contribution &&
        canAssign &&
        !category.followsHost &&
        (state === "claimed" || state === "assigned" || state === "yours") ? (
          <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
            <AssignContributionForm
              eventId={eventId}
              groupId={groupId}
              category={category}
              members={members}
              contributionId={contribution.id}
              submitLabel="Reassign"
            />
            <AuthForm
              action={releaseContributionAsManagerAction}
              submitLabel="Clear assignment"
              hiddenFields={{
                event_id: eventId,
                contribution_id: contribution.id,
              }}
              refreshOnSuccess
            >
              <p className="text-sm text-muted-foreground">
                Open this category for someone else to claim.
              </p>
            </AuthForm>
          </div>
        ) : null}
      </HuiSurface>
    </li>
  );
}

function ClaimForm({
  eventId,
  groupId,
  category,
}: {
  eventId: string;
  groupId: string;
  category: ContributionCategoryRow;
}) {
  return (
    <AuthForm
      action={claimContributionAction}
      submitLabel={`Claim ${category.name}`}
      hiddenFields={{
        event_id: eventId,
        group_id: groupId,
        category_id: category.id,
        category_name: category.name,
      }}
      refreshOnSuccess
    >
      <AuthField label="What you're bringing (optional)" name="description" required={false} />
    </AuthForm>
  );
}

function AssignContributionForm({
  eventId,
  groupId,
  category,
  members,
  contributionId,
  submitLabel,
}: {
  eventId: string;
  groupId: string;
  category: ContributionCategoryRow;
  members: ContributionMember[];
  contributionId?: string;
  submitLabel: string;
}) {
  const action = contributionId
    ? reassignContributionAsManagerAction
    : assignContributionAsManagerAction;

  return (
    <AuthForm
      action={action}
      submitLabel={submitLabel}
      hiddenFields={{
        event_id: eventId,
        group_id: groupId,
        category_id: category.id,
        ...(contributionId ? { contribution_id: contributionId } : {}),
      }}
      refreshOnSuccess
    >
      <label className="hui-label">
        Member
        <select name="member_user_id" required defaultValue="" className="hui-input">
          <option value="" disabled>Select a member</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.displayName}
            </option>
          ))}
        </select>
      </label>
      <AuthField label="What they're bringing (optional)" name="description" required={false} />
    </AuthForm>
  );
}

function ManageContributionForm({
  eventId,
  contribution,
}: {
  eventId: string;
  contribution: EventContributionRow;
}) {
  return (
    <div className="space-y-4">
      <AuthForm
        action={updateContributionAction}
        submitLabel="Update description"
        hiddenFields={{
          event_id: eventId,
          contribution_id: contribution.id,
        }}
        refreshOnSuccess
      >
        <AuthField
          label="Description"
          name="description"
          defaultValue={contribution.label}
          required
        />
      </AuthForm>
      <AuthForm
        action={releaseContributionAction}
        submitLabel="Release contribution"
        hiddenFields={{
          event_id: eventId,
          contribution_id: contribution.id,
        }}
        refreshOnSuccess
      >
        <p className="text-sm text-muted-foreground">
          Release this category so someone else can claim it.
        </p>
      </AuthForm>
    </div>
  );
}
