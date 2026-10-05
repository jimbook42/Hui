"use client";

import { useActionState, useState } from "react";

import {
  createGroupSetupAction,
  updateGroupSettingsAction,
  type GroupActionState,
  type GroupSetupActionState,
} from "@/app/groups/actions";
import { AuthField } from "@/components/auth/auth-form";
import { GroupInviteSection } from "@/components/groups/group-invite-section";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSwitchField } from "@/components/hui/hui-switch";
import { PendingButton } from "@/components/ui/pending-button";

type Step = "people" | "how" | "ready";

type CreateGroupFlowProps = {
  appOrigin: string;
};

const initialSetupState: GroupSetupActionState = {};

export function CreateGroupFlow({ appOrigin }: CreateGroupFlowProps) {
  const [manualStep, setManualStep] = useState<Step | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [hostingEnabled, setHostingEnabled] = useState(true);
  const [maybeEnabled, setMaybeEnabled] = useState(true);

  const [setupState, setupFormAction, setupPending] = useActionState(
    async (prev: GroupSetupActionState, formData: FormData) => {
      const result = await createGroupSetupAction(prev, formData);
      if (result.groupId) {
        setGroupId(result.groupId);
        const name = String(formData.get("name") ?? "").trim();
        if (name) {
          setGroupName(name);
        }
        if (result.inviteToken) {
          setInviteToken(result.inviteToken);
        }
        setManualStep("how");
      }
      return result;
    },
    initialSetupState,
  );

  const resolvedGroupId = groupId ?? setupState.groupId ?? null;
  const resolvedInviteToken = inviteToken ?? setupState.inviteToken ?? null;

  const step: Step = manualStep ?? (resolvedGroupId ? "how" : "people");

  return (
    <div className="space-y-6">
      {step === "people" ? (
        <section className="space-y-4">
          <h2 className="hui-type-page-title text-foreground">Who&apos;s part of this group?</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            Start with a name, then invite people. You can add more members any time.
          </p>
          <form action={setupFormAction} className="space-y-4">
            <AuthField label="Group name" name="name" autoComplete="organization" required />
            {setupState.error ? (
              <p className="hui-message-error" role="alert">{setupState.error}</p>
            ) : null}
            <PendingButton type="submit" pendingLabel="Creating…" size="touch" disabled={setupPending}>
              {setupPending ? "Creating…" : "Continue"}
            </PendingButton>
          </form>
        </section>
      ) : null}

      {step === "how" && resolvedGroupId && resolvedInviteToken ? (
        <section className="space-y-8">
          <div>
            <h2 className="hui-type-page-title text-foreground">Invite people</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Share the link now or return later from the group page.
            </p>
            <div className="mt-4">
              <GroupInviteSection
                groupId={resolvedGroupId}
                groupName={groupName ?? undefined}
                inviteToken={resolvedInviteToken}
                appOrigin={appOrigin}
              />
            </div>
          </div>

          <div>
            <h2 className="hui-type-section text-foreground">How this group works</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Group-level defaults only — each hui still chooses its own food, place, and host details.
            </p>
            <GroupSetupSettingsForm
              groupId={resolvedGroupId}
              hostingEnabled={hostingEnabled}
              maybeEnabled={maybeEnabled}
              onHostingEnabledChange={setHostingEnabled}
              onMaybeEnabledChange={setMaybeEnabled}
              onSaved={() => setManualStep("ready")}
            />
            <PendingButton
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => setManualStep("ready")}
            >
              Skip for now
            </PendingButton>
          </div>
        </section>
      ) : null}

      {step === "ready" && resolvedGroupId ? (
        <section className="space-y-4">
          <h2 className="hui-type-page-title text-foreground">Ready</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            Your group is set up. Propose the first hui when you are ready.
          </p>
          <div className="flex flex-wrap gap-3">
            <HuiLinkButton href={`/groups/${resolvedGroupId}/events/new`} size="touch">
              Propose a hui
            </HuiLinkButton>
            <HuiLinkButton href={`/groups/${resolvedGroupId}`} variant="secondary">
              Open group
            </HuiLinkButton>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GroupSetupSettingsForm({
  groupId,
  hostingEnabled,
  maybeEnabled,
  onHostingEnabledChange,
  onMaybeEnabledChange,
  onSaved,
}: {
  groupId: string;
  hostingEnabled: boolean;
  maybeEnabled: boolean;
  onHostingEnabledChange: (value: boolean) => void;
  onMaybeEnabledChange: (value: boolean) => void;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: GroupActionState, formData: FormData) => {
      const result = await updateGroupSettingsAction(prev, formData);
      if (result.message) {
        onSaved();
      }
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="who_may_propose" value="any_member" />
      <input type="hidden" name="one_off_events_allowed" value="on" />
      <input type="hidden" name="recurring_events_enabled" value="on" />
      <input type="hidden" name="minimum_attendees" value="1" />
      <input type="hidden" name="consensus_rule" value="required_participants" />
      <input type="hidden" name="timezone" value="Pacific/Auckland" />
      <div className="space-y-3">
        <HuiSwitchField
          name="hosting_enabled"
          label="Use a host for gatherings"
          description="When off, hui events skip host suggestions and acceptance."
          checked={hostingEnabled}
          onCheckedChange={onHostingEnabledChange}
        />
        <HuiSwitchField
          name="maybe_responses_enabled"
          label="“Could make it work” responses"
          description="Lets people say they could make a time work if needed."
          checked={maybeEnabled}
          onCheckedChange={onMaybeEnabledChange}
        />
      </div>
      {state.error ? <p className="hui-message-error" role="alert">{state.error}</p> : null}
      <PendingButton type="submit" pendingLabel="Saving…" disabled={pending}>
        {pending ? "Saving…" : "Save and continue"}
      </PendingButton>
    </form>
  );
}
