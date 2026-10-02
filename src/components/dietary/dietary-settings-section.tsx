"use client";

import {
  createDietaryEntryAction,
  deleteDietaryEntryAction,
  shareDietaryEntryAction,
  unshareDietaryEntryAction,
  updateDietaryEntryAction,
} from "@/app/dietary/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { dietaryCategoryLabel } from "@/domain/dietary/display";
import { DIETARY_CATEGORIES, type DietaryCategory } from "@/domain/dietary/validation";
import type { UserDietaryEntry, UserGroupOption } from "@/lib/dietary/types";

type DietarySettingsSectionProps = {
  entries: UserDietaryEntry[];
  groups: UserGroupOption[];
};

function CategoryField({ defaultValue }: { defaultValue?: DietaryCategory }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Type
      </label>
      <select
        name="category"
        defaultValue={defaultValue ?? "requirement"}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      >
        {DIETARY_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {dietaryCategoryLabel(category)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-zinc-500">
        Self-reported labels only — not a medical record.
      </p>
    </div>
  );
}

function DietaryEntryCard({
  entry,
  groups,
}: {
  entry: UserDietaryEntry;
  groups: UserGroupOption[];
}) {
  const sharedGroupIds = new Set(entry.shares.map((share) => share.groupId));
  const unsharedGroups = groups.filter((group) => !sharedGroupIds.has(group.groupId));

  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{entry.label}</p>
          {entry.notes ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{entry.notes}</p>
          ) : null}
          <p className="mt-1 text-xs text-zinc-500">{dietaryCategoryLabel(entry.category)}</p>
        </div>
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {entry.shares.length === 0 ? "Private" : "Shared"}
        </p>
      </div>

      {entry.shares.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
          {entry.shares.map((share) => (
            <li key={share.groupId} className="flex flex-wrap items-center gap-2">
              <span>Shared with {share.groupName}</span>
              <AuthForm
                action={unshareDietaryEntryAction}
                submitLabel="Stop sharing"
                hiddenFields={{
                  entry_id: entry.id,
                  group_id: share.groupId,
                }}
                refreshOnSuccess
              >
                <span className="sr-only">Stop sharing with {share.groupName}</span>
              </AuthForm>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Only you can see this until you share it with a group.
        </p>
      )}

      {unsharedGroups.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Share with a group</p>
          {unsharedGroups.map((group) => (
            <AuthForm
              key={group.groupId}
              action={shareDietaryEntryAction}
              submitLabel={`Share with ${group.groupName}`}
              hiddenFields={{
                entry_id: entry.id,
                group_id: group.groupId,
              }}
              refreshOnSuccess
            >
              <span className="sr-only">Share with {group.groupName}</span>
            </AuthForm>
          ))}
        </div>
      ) : null}

      <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Edit</p>
        <div className="mt-2 max-w-md">
          <AuthForm
            action={updateDietaryEntryAction}
            submitLabel="Save changes"
            hiddenFields={{ entry_id: entry.id }}
            refreshOnSuccess
          >
            <AuthField label="Label" name="label" defaultValue={entry.label} required />
            <AuthField
              label="Optional detail"
              name="notes"
              defaultValue={entry.notes ?? ""}
              required={false}
            />
            <CategoryField defaultValue={entry.category} />
          </AuthForm>
        </div>
      </div>

      <div className="mt-4">
        <AuthForm
          action={deleteDietaryEntryAction}
          submitLabel="Remove"
          hiddenFields={{ entry_id: entry.id }}
          refreshOnSuccess
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Remove this entry from your account. Shared copies disappear from groups immediately.
          </p>
        </AuthForm>
      </div>
    </li>
  );
}

export function DietarySettingsSection({ entries, groups }: DietarySettingsSectionProps) {
  return (
    <div className="space-y-6">
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You haven&apos;t added any dietary information.
        </p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <DietaryEntryCard key={entry.id} entry={entry} groups={groups} />
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Add dietary information
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          Examples: Vegetarian, Gluten-free, Nut allergy. New entries are private until you share them.
        </p>
        <div className="mt-4 max-w-md">
          <AuthForm
            action={createDietaryEntryAction}
            submitLabel="Add entry"
            refreshOnSuccess
          >
            <AuthField label="Label" name="label" required />
            <AuthField label="Optional detail" name="notes" required={false} />
            <CategoryField />
          </AuthForm>
        </div>
      </div>
    </div>
  );
}
