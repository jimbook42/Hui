"use client";

import {
  createContributionCategoryAction,
  deactivateContributionCategoryAction,
  renameContributionCategoryAction,
  setContributionCategoryDefaultAssigneeAction,
  updateContributionCategoryRulesAction,
} from "@/app/contributions/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { HuiSwitchField } from "@/components/hui/hui-switch";
import type { ContributionCategoryRow } from "@/lib/contributions/types";

type ContributionMember = {
  userId: string;
  displayName: string;
};

type ContributionCategoriesAdminProps = {
  groupId: string;
  categories: ContributionCategoryRow[];
  members: ContributionMember[];
};

export function ContributionCategoriesAdmin({
  groupId,
  categories,
  members,
}: ContributionCategoriesAdminProps) {
  const active = categories.filter((c) => c.archivedAt === null);
  const archived = categories.filter((c) => c.archivedAt !== null);

  return (
    <div className="space-y-6">
      <AuthForm
        action={createContributionCategoryAction}
        submitLabel="Add category"
        hiddenFields={{ group_id: groupId }}
        refreshOnSuccess
      >
        <AuthField label="New category" name="name" required />
      </AuthForm>

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No contribution categories yet. Add categories your group can claim on events.
        </p>
      ) : (
        <ul className="space-y-4">
          {active.map((category) => (
            <li
              key={category.id}
              className="rounded-hui-md p-4 bg-muted"
            >
              <CategoryRow groupId={groupId} category={category} members={members} />
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <div>
          <h3 className="text-sm font-bold text-foreground">Inactive</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {archived.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CategoryRow({
  groupId,
  category,
  members,
}: {
  groupId: string;
  category: ContributionCategoryRow;
  members: ContributionMember[];
}) {
  return (
    <div className="space-y-3">
      <p className="font-medium text-foreground">{category.name}</p>
      <AuthForm
        action={renameContributionCategoryAction}
        submitLabel="Rename"
        hiddenFields={{ group_id: groupId, category_id: category.id }}
        refreshOnSuccess
      >
        <AuthField label="Rename" name="name" defaultValue={category.name} required />
      </AuthForm>
      <AuthForm
        action={updateContributionCategoryRulesAction}
        submitLabel="Save category rules"
        hiddenFields={{ group_id: groupId, category_id: category.id }}
        refreshOnSuccess
      >
        <HuiSwitchField
          name="follows_host"
          label="Follows the host (for example, main dish)"
          defaultChecked={category.followsHost}
        />
      </AuthForm>
      <AuthForm
        action={setContributionCategoryDefaultAssigneeAction}
        submitLabel="Save standing preference"
        hiddenFields={{ group_id: groupId, category_id: category.id }}
        refreshOnSuccess
      >
        <label className="hui-label">
          Usually brings this (optional)
          <select
            name="default_assignee_user_id"
            className="hui-input"
            defaultValue={category.defaultAssigneeUserId ?? ""}
          >
            <option value="">No standing preference</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-muted-foreground">
          Applies when new events seed contributions. Changing this does not rewrite past events.
        </p>
      </AuthForm>
      <AuthForm
        action={deactivateContributionCategoryAction}
        submitLabel="Deactivate"
        hiddenFields={{ group_id: groupId, category_id: category.id }}
        refreshOnSuccess
      >
        <p className="text-sm text-muted-foreground">
          Deactivated categories stay on past events but cannot be claimed on new ones.
        </p>
      </AuthForm>
    </div>
  );
}
