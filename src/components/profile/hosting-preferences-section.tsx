"use client";

import { setMyHostingStandingAction } from "@/app/groups/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { hostingOptions } from "@/lib/groups/hosting-options";
import type { MemberHostingStanding } from "@/lib/groups/types";

export type HostingPreference = {
  groupId: string;
  groupName: string;
  standing: MemberHostingStanding;
};

/** Per-group hosting preference, using the same action as the group page. */
export function HostingPreferencesSection({ preferences }: { preferences: HostingPreference[] }) {
  if (preferences.length === 0) {
    return (
      <p className="hui-type-supporting">
        Join a group and you can say how you feel about hosting there.
      </p>
    );
  }

  return (
    <ul className="space-y-5">
      {preferences.map((preference) => (
        <li key={preference.groupId} className="rounded-hui-lg bg-muted p-4">
          <AuthForm
            action={setMyHostingStandingAction}
            submitLabel="Save"
            hiddenFields={{ group_id: preference.groupId }}
            refreshOnSuccess
          >
            <label className="hui-label">
              <span>{preference.groupName}</span>
              <select
                name="hosting_standing"
                defaultValue={preference.standing}
                className="hui-input"
              >
                {hostingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </AuthForm>
        </li>
      ))}
    </ul>
  );
}
