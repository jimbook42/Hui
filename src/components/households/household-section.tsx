"use client";

import { useActionState } from "react";

import type { HouseholdActionState } from "@/app/households/actions";
import {
  addHouseholdMemberAction,
  createHouseholdAction,
  removeHouseholdMemberAction,
  updateHouseholdNameAction,
} from "@/app/households/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";
import type { UserHouseholdInGroup } from "@/lib/households/queries";

const initialState: HouseholdActionState = {};

function HouseholdGroupCard({
  context,
  currentUserId,
}: {
  context: UserHouseholdInGroup;
  currentUserId: string;
}) {
  if (!context.household) {
    return (
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {context.groupName}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          You are not in a household for this group yet.
        </p>
        <div className="mt-4 max-w-md">
          <AuthForm
            action={createHouseholdAction}
            submitLabel="Create household"
            hiddenFields={{ group_id: context.groupId }}
            refreshOnSuccess
          >
            <AuthField label="Household name" name="name" required />
          </AuthForm>
        </div>
      </div>
    );
  }

  const household = context.household;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {context.groupName}
      </h3>
      <p className="mt-1 text-xs text-zinc-500">
        Households are per group. Other members of this group can see household
        names and who is grouped together.
      </p>

      <div className="mt-4 max-w-md">
        <AuthForm
          action={updateHouseholdNameAction}
          submitLabel="Save household name"
          hiddenFields={{
            household_id: household.id,
            group_id: context.groupId,
          }}
          refreshOnSuccess
        >
          <AuthField label="Household name" name="name" defaultValue={household.name} required />
        </AuthForm>
      </div>

      <h4 className="mt-6 text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Members
      </h4>
      <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {household.members.map((member) => (
          <li
            key={member.userId}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {member.displayName}
              {member.userId === currentUserId ? " (you)" : ""}
            </span>
            <RemoveHouseholdMemberButton
              householdId={household.id}
              groupId={context.groupId}
              userId={member.userId}
              displayName={member.displayName}
            />
          </li>
        ))}
      </ul>

      <div className="mt-4 max-w-md">
        <AuthForm
          action={addHouseholdMemberAction}
          submitLabel="Add to household"
          hiddenFields={{
            household_id: household.id,
            group_id: context.groupId,
          }}
          refreshOnSuccess
        >
          <AuthField
            label="Member user ID"
            name="user_id"
            autoComplete="off"
            required
          />
          <p className="text-xs text-zinc-500">
            They must already be an active member of {context.groupName}. Copy their
            member ID from their profile page.
          </p>
        </AuthForm>
      </div>
    </div>
  );
}

function RemoveHouseholdMemberButton({
  householdId,
  groupId,
  userId,
  displayName,
}: {
  householdId: string;
  groupId: string;
  userId: string;
  displayName: string;
}) {
  const [state, formAction, pending] = useActionState(
    removeHouseholdMemberAction,
    initialState,
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="household_id" value={householdId} />
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="user_id" value={userId} />
      {state.error ? (
        <p className="text-xs text-red-600" role="alert">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-red-700 underline-offset-4 hover:underline dark:text-red-400"
      >
        Remove {displayName}
      </button>
    </form>
  );
}

export function HouseholdSettingsSection({
  contexts,
  currentUserId,
}: {
  contexts: UserHouseholdInGroup[];
  currentUserId: string;
}) {
  if (contexts.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Join a group to create or manage a household.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {contexts.map((context) => (
        <HouseholdGroupCard
          key={context.groupId}
          context={context}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
