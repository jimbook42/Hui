"use client";

import {
  createContributionCategoryAction,
  deactivateContributionCategoryAction,
  renameContributionCategoryAction,
  updateContributionCategoryRulesAction,
} from "@/app/contributions/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import type { ContributionCategoryRow } from "@/lib/contributions/types";

type ContributionCategoriesAdminProps = {
  groupId: string;
  categories: ContributionCategoryRow[];
};

export function ContributionCategoriesAdmin({
  groupId,
  categories,
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
              <CategoryRow groupId={groupId} category={category} />
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
}: {
  groupId: string;
  category: ContributionCategoryRow;
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
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="follows_host"
            defaultChecked={category.followsHost}
            className="rounded"
          />
          <span>Follows the host (for example, main dish)</span>
        </label>
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
