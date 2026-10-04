"use client";

import {
  claimContributionAction,
  releaseContributionAction,
  updateContributionAction,
} from "@/app/contributions/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { buildContributionBoard } from "@/domain/contributions/display";
import { sharedDietaryReminder } from "@/domain/dietary/display";
import type { ContributionCategoryRow, EventContributionRow } from "@/lib/contributions/types";

type EventContributionsSectionProps = {
  eventId: string;
  groupId: string;
  eventStatus: string;
  canCoordinate: boolean;
  isProposed: boolean;
  categories: ContributionCategoryRow[];
  contributions: EventContributionRow[];
  viewerUserId: string;
  viewerHistoryCount: number | null;
  sharedDietaryCount: number;
};

function contributionLine(contribution: EventContributionRow): string {
  const category = contribution.categoryName ?? "Contribution";
  const who = contribution.displayName ?? "Member";
  const detail =
    contribution.label.toLowerCase() === category.toLowerCase()
      ? ""
      : `: ${contribution.label}`;
  return `${category} — ${who}${detail}`;
}

export function EventContributionsSection({
  eventId,
  groupId,
  eventStatus,
  canCoordinate,
  isProposed,
  categories,
  contributions,
  viewerUserId,
  viewerHistoryCount,
  sharedDietaryCount,
}: EventContributionsSectionProps) {
  const board = buildContributionBoard(categories, contributions, viewerUserId);
  const hasActiveCategories = categories.some((c) => c.archivedAt === null);
  const dietaryReminder = sharedDietaryReminder(sharedDietaryCount);

  if (eventStatus === "cancelled") {
    return (
      <section id="contributions" className="hui-card-section">
        <h2 className="hui-type-section text-foreground">Contributions</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This event was cancelled. Contribution coordination is closed.
        </p>
        {board.claimed.length > 0 ? (
          <ul className="mt-4 space-y-1 text-sm text-foreground">
            {board.claimed.map((c) => (
              <li key={c.id}>{contributionLine(c)}</li>
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
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-foreground">Still needed</h3>
            {board.stillNeeded.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Every active category has someone bringing it.
              </p>
            ) : (
              <ul className="mt-2 space-y-3">
                {board.stillNeeded.map((category) => (
                  <li key={category.id}>
                    {canCoordinate ? (
                      <ClaimForm
                        eventId={eventId}
                        groupId={groupId}
                        category={category}
                      />
                    ) : (
                      <span className="text-sm text-foreground">{category.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-foreground">Claimed</h3>
            {board.claimed.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No one has claimed a contribution yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {board.claimed.map((c) => (
                  <li key={c.id}>{contributionLine(c)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {board.mine.length > 0 && canCoordinate ? (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-foreground">Your contributions</h3>
          <ul className="mt-3 space-y-4">
            {board.mine.map((contribution) => (
              <li
                key={contribution.id}
                className="rounded-hui-md p-4 bg-muted"
              >
                <p className="text-sm font-bold text-foreground">
                  {contribution.categoryName ?? "Contribution"}
                </p>
                <ManageContributionForm eventId={eventId} contribution={contribution} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!canCoordinate && board.claimed.length > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          This event is complete. Contribution claims are read-only.
        </p>
      ) : null}
    </section>
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
    <div className="rounded-hui-md p-3 bg-muted">
      <p className="text-sm font-bold text-foreground">{category.name}</p>
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
        <AuthField
          label="What you're bringing (optional)"
          name="description"
          required={false}
        />
      </AuthForm>
    </div>
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
    <div className="mt-3 space-y-4">
      <p className="text-sm text-muted-foreground">{contribution.label}</p>
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
