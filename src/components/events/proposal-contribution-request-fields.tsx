"use client";

import type { ProposalContributionRequest } from "@/domain/events/proposal";
import type { ContributionCategoryRow } from "@/lib/contributions/types";

type ProposalContributionRequestFieldsProps = {
  categories: ContributionCategoryRow[];
  requestedContributions: ProposalContributionRequest[];
  onChange: (next: ProposalContributionRequest[]) => void;
};

export function ProposalContributionRequestFields({
  categories,
  requestedContributions,
  onChange,
}: ProposalContributionRequestFieldsProps) {
  if (categories.length === 0) {
    return (
      <p className="text-sm font-semibold text-muted-foreground">
        Add categories in group settings if you want people to bring something
        specific for this gathering.
      </p>
    );
  }

  function toggle(categoryId: string, categoryName: string) {
    const exists = requestedContributions.some((row) => row.categoryId === categoryId);
    if (exists) {
      onChange(requestedContributions.filter((row) => row.categoryId !== categoryId));
      return;
    }
    onChange([...requestedContributions, { categoryId, label: categoryName }]);
  }

  return (
    <div className="space-y-3 rounded-hui-xl bg-surface p-4 sm:p-5 hui-shadow-md">
      <div>
        <p className="text-sm font-extrabold text-foreground">What to bring (optional)</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">
          Choose what you&apos;d like help with for this gathering. You can skip this.
        </p>
      </div>
      <ul className="space-y-2">
        {categories.map((category) => {
          const selected = requestedContributions.some((row) => row.categoryId === category.id);
          const request = requestedContributions.find((row) => row.categoryId === category.id);
          return (
            <li key={category.id} className="rounded-hui-lg bg-muted px-3 py-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="hui-checkbox"
                  checked={selected}
                  onChange={() => toggle(category.id, category.name)}
                />
                <span className="font-extrabold text-foreground">{category.name}</span>
              </label>
              {selected ? (
                <label className="mt-2 block text-sm font-semibold text-muted-foreground">
                  <span className="hui-label">Item or note (optional)</span>
                  <input
                    className="hui-input mt-1"
                    value={request?.label ?? category.name}
                    maxLength={160}
                    onChange={(event) =>
                      onChange(
                        requestedContributions.map((row) =>
                          row.categoryId === category.id
                            ? { ...row, label: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
