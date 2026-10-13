"use client";

import {
  createDietaryEntryAction,
  deleteDietaryEntryAction,
  setDietaryGlobalShareAction,
  setDietaryGroupShareAction,
  updateDietaryEntryAction,
} from "@/app/dietary/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import { deriveDietarySharingScope } from "@/domain/dietary/sharing-scope";
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
      <label className="mb-1 block text-sm font-medium text-foreground">Type</label>
      <select
        name="category"
        defaultValue={defaultValue ?? "requirement"}
        className="hui-input"
      >
        {DIETARY_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {dietaryCategoryLabel(category)}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        Self-reported labels only — not a medical record.
      </p>
    </div>
  );
}

function DietarySharingScopeSection({
  entries,
  groups,
}: {
  entries: UserDietaryEntry[];
  groups: UserGroupOption[];
}) {
  const scope = deriveDietarySharingScope(entries, groups);

  if (scope.entryCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add at least one entry before you can share dietary information with a group.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-hui-md bg-muted p-4">
        <p className="text-sm font-extrabold text-foreground">Share all my dietary preferences with all my Hui groups</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {scope.shareAllGroups
            ? "On. Members of every group you are in can see all your entries, including groups you join later."
            : scope.shareAllPartial
              ? "Some entries use all-groups sharing. Turn this on to align every entry, or off to stop all-groups sharing."
              : "Off. Only groups you choose below can see your entries."}
        </p>
        <div className="mt-2">
          <AuthForm
            action={setDietaryGlobalShareAction}
            submitLabel={scope.shareAllGroups ? "Stop sharing with all my groups" : "Share with all my groups"}
            hiddenFields={{ enabled: scope.shareAllGroups ? "false" : "true" }}
            refreshOnSuccess
          >
            <span className="sr-only">Global dietary sharing</span>
          </AuthForm>
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-extrabold text-foreground">Share with a group</p>
          <ul className="space-y-3">
            {scope.groups.map((group) => (
              <li key={group.groupId} className="rounded-hui-md bg-surface p-3 hui-shadow-sm">
                <p className="text-sm font-bold text-foreground">{group.groupName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {group.enabled
                    ? "All your entries are shared with this group."
                    : group.partial
                      ? "Only some entries are shared — use the button below to share all of them with this group."
                      : "Not shared with this group yet."}
                </p>
                <div className="mt-2">
                  <AuthForm
                    action={setDietaryGroupShareAction}
                    submitLabel={
                      group.enabled
                        ? `Stop sharing with ${group.groupName}`
                        : `Share with ${group.groupName}`
                    }
                    hiddenFields={{
                      group_id: group.groupId,
                      enabled: group.enabled ? "false" : "true",
                    }}
                    refreshOnSuccess
                  >
                    <span className="sr-only">Group dietary sharing for {group.groupName}</span>
                  </AuthForm>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DietaryEntryCard({ entry }: { entry: UserDietaryEntry }) {
  return (
    <li className="rounded-hui-md p-4 bg-muted">
      <div>
        <p className="text-sm font-extrabold text-foreground">{entry.label}</p>
        {entry.notes ? (
          <p className="mt-1 text-sm text-muted-foreground">{entry.notes}</p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">{dietaryCategoryLabel(entry.category)}</p>
      </div>

      <div className="mt-6 pt-4">
        <p className="text-xs font-medium text-foreground">Edit</p>
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
          <p className="text-sm text-muted-foreground">
            Remove this entry from your account. Shared copies disappear from groups immediately.
          </p>
        </AuthForm>
      </div>
    </li>
  );
}

export function DietarySettingsSection({ entries, groups }: DietarySettingsSectionProps) {
  return (
    <div className="space-y-8">
      <DietarySharingScopeSection entries={entries} groups={groups} />

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven&apos;t added any dietary information.</p>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <DietaryEntryCard key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      <div className="rounded-hui-md border-dashed p-4 bg-muted">
        <h3 className="text-sm font-extrabold text-foreground">Add dietary information</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Examples: Vegetarian, Gluten-free, Nut allergy. New entries are private until you share them.
        </p>
        <div className="mt-4 max-w-md">
          <AuthForm action={createDietaryEntryAction} submitLabel="Add entry" refreshOnSuccess>
            <AuthField label="Label" name="label" required />
            <AuthField label="Optional detail" name="notes" required={false} />
            <CategoryField />
          </AuthForm>
        </div>
      </div>
    </div>
  );
}
