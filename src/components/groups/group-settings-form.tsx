"use client";

import { updateGroupSettingsAction } from "@/app/groups/actions";
import { AuthForm } from "@/components/auth/auth-form";
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
        <legend className="text-sm font-bold text-foreground">
          Event rules
        </legend>
        <label className="hui-label">
          <span>Who may propose events</span>
          <select
            name="who_may_propose"
            defaultValue={settings.whoMayPropose}
            className="hui-input"
          >
            <option value="any_member">Any member</option>
            <option value="admins_only">Admins only</option>
          </select>
        </label>
        <HuiSwitchField
          name="one_off_events_allowed"
          label="One-off events allowed"
          defaultChecked={settings.oneOffEventsAllowed}
        />
        <HuiSwitchField
          name="recurring_events_enabled"
          label="Recurring events enabled"
          defaultChecked={settings.recurringEventsEnabled}
        />
        <HuiSwitchField
          name="maybe_responses_enabled"
          label="Maybe responses enabled"
          defaultChecked={settings.maybeResponsesEnabled}
        />
        <label className="hui-label">
          <span>Minimum attendees</span>
          <input
            type="number"
            name="minimum_attendees"
            min={1}
            defaultValue={settings.minimumAttendees}
            className="hui-input"
          />
        </label>
        <label className="hui-label">
          <span>Proposal deadline (hours, optional)</span>
          <input
            type="number"
            name="proposal_deadline_hours"
            min={1}
            defaultValue={settings.proposalDeadlineHours ?? ""}
            className="hui-input"
          />
        </label>
        <label className="hui-label">
          <span>Consensus rule</span>
          <select
            name="consensus_rule"
            defaultValue={settings.consensusRule}
            className="hui-input"
          >
            <option value="required_participants">Required participants</option>
            <option value="minimum_attendees">Minimum attendees</option>
            <option value="all_active_members">All active members</option>
          </select>
        </label>
        <HuiSwitchField
          name="admin_veto_enabled"
          label="Admin veto"
          defaultChecked={settings.adminVetoEnabled}
        />
        <HuiSwitchField
          name="hosting_enabled"
          label="Use a host for gatherings"
          defaultChecked={settings.hostingEnabled}
        />
        <HuiSwitchField
          name="avoid_consecutive_hosts"
          label="Don't ask the same person to host twice in a row"
          defaultChecked={settings.avoidConsecutiveHosts}
        />
        <label className="hui-label">
          <span>Timezone for event times</span>
          <input
            type="text"
            name="timezone"
            defaultValue={settings.timezone}
            className="hui-input"
          />
        </label>
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
    </AuthForm>
  );
}
