"use client";

import { updateGroupSettingsAction } from "@/app/groups/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { ChevronDownIcon } from "@/components/hui/icons";
import { HuiSwitchField } from "@/components/hui/hui-switch";

import type { GroupSettingsRow } from "@/lib/groups/types";

type GroupSettingsFormProps = {
  groupId: string;
  settings: GroupSettingsRow;
};

export function GroupSettingsForm({ groupId, settings }: GroupSettingsFormProps) {
  return (
    <AuthForm
      action={updateGroupSettingsAction}
      submitLabel="Save settings"
      hiddenFields={{ group_id: groupId }}
    >
      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-foreground">How your group plans</legend>
        <label className="hui-label">
          <span>Who can suggest a new gathering</span>
          <select
            name="who_may_propose"
            defaultValue={settings.whoMayPropose}
            className="hui-input"
          >
            <option value="any_member">Anyone in the group</option>
            <option value="admins_only">Admins only</option>
          </select>
        </label>
        <label className="hui-label">
          <span>Planning reminders</span>
          <select
            name="planning_reminders_audience"
            defaultValue={settings.planningRemindersAudience}
            className="hui-input"
          >
            <option value="admins_only">Admins only</option>
            <option value="everyone">Everyone in the group</option>
          </select>
        </label>
        <HuiSwitchField
          name="hosting_enabled"
          label="Use a host for gatherings"
          defaultChecked={settings.hostingEnabled}
        />
        <label className="hui-label">
          <span>Time zone for gathering times</span>
          <input
            type="text"
            name="timezone"
            defaultValue={settings.timezone}
            className="hui-input"
          />
        </label>
      </fieldset>

      <details className="hui-details mt-6 rounded-hui-lg bg-muted/40 hui-shadow-sm">
        <summary className="hui-focus-ring flex min-h-14 items-center justify-between gap-3 rounded-hui-lg px-5 py-3">
          <span>
            <span className="block font-extrabold text-foreground">Advanced</span>
            <span className="block text-sm font-semibold text-muted-foreground">
              Consensus rules, minimums, deadlines, and other fine-tuning
            </span>
          </span>
          <span className="hui-details-chevron text-muted-foreground" aria-hidden="true">
            <ChevronDownIcon size={20} />
          </span>
        </summary>
        <fieldset className="space-y-4 px-5 pb-5 pt-2">
          <HuiSwitchField
            name="one_off_events_allowed"
            label="One-off gatherings allowed"
            defaultChecked={settings.oneOffEventsAllowed}
          />
          <HuiSwitchField
            name="recurring_events_enabled"
            label="Recurring rhythm enabled"
            defaultChecked={settings.recurringEventsEnabled}
          />
          <HuiSwitchField
            name="maybe_responses_enabled"
            label="Allow &quot;Maybe&quot; answers"
            defaultChecked={settings.maybeResponsesEnabled}
          />
          <label className="hui-label">
            <span>Minimum people needed to confirm</span>
            <input
              type="number"
              name="minimum_attendees"
              min={1}
              defaultValue={settings.minimumAttendees}
              className="hui-input"
            />
          </label>
          <label className="hui-label">
            <span>Reply deadline (hours, optional)</span>
            <input
              type="number"
              name="proposal_deadline_hours"
              min={1}
              defaultValue={settings.proposalDeadlineHours ?? ""}
              className="hui-input"
            />
          </label>
          <label className="hui-label">
            <span>How answers must line up to confirm</span>
            <select
              name="consensus_rule"
              defaultValue={settings.consensusRule}
              className="hui-input"
            >
              <option value="required_participants">Everyone who must reply</option>
              <option value="minimum_attendees">Minimum people needed</option>
              <option value="all_active_members">Everyone in the group</option>
              <option value="majority_active_members">Most of the group</option>
            </select>
          </label>
          <HuiSwitchField
            name="admin_veto_enabled"
            label="Admins can block confirmation"
            defaultChecked={settings.adminVetoEnabled}
          />
          <HuiSwitchField
            name="avoid_consecutive_hosts"
            label="Don&apos;t ask the same person to host twice in a row"
            defaultChecked={settings.avoidConsecutiveHosts}
          />
          <HuiSwitchField
            name="reconnect_reminders_enabled"
            label="Reconnect reminders"
            defaultChecked={settings.reconnectRemindersEnabled}
          />
          <label className="hui-label">
            <span>Reconnect after (days, when enabled)</span>
            <input
              type="number"
              name="reconnect_after_days"
              min={1}
              defaultValue={settings.reconnectAfterDays ?? ""}
              className="hui-input"
            />
          </label>
        </fieldset>
      </details>
    </AuthForm>
  );
}
