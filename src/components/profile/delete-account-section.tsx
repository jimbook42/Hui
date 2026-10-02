"use client";

import { useActionState, useState } from "react";

import {
  deleteAccountAction,
  type AuthActionState,
} from "@/app/auth/actions";
import { ACCOUNT_DELETION_CONFIRMATION } from "@/lib/auth/account-deletion";

const initialState: AuthActionState = {};

export function DeleteAccountSection() {
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    initialState,
  );
  const canSubmit = confirmation === ACCOUNT_DELETION_CONFIRMATION && !pending;

  return (
    <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Account
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Delete your Hui account? This permanently removes your account and
        personal information. You will leave all groups. Some shared group and
        event history may remain for other members.
      </p>
      <form action={formAction} className="mt-4 max-w-md">
        {state.error ? (
          <p className="mb-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {state.error}
          </p>
        ) : null}
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Type {ACCOUNT_DELETION_CONFIRMATION} to confirm
          <input
            type="text"
            name="confirmation"
            autoComplete="off"
            disabled={pending}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          {pending ? "Deleting account…" : "Delete my account"}
        </button>
      </form>
    </section>
  );
}
