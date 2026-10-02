"use client";

import { useActionState, useState } from "react";

import {
  deleteAccountAction,
  type AuthActionState,
} from "@/app/auth/actions";
import { ACCOUNT_DELETION_CONFIRMATION } from "@/lib/auth/account-deletion";

const initialState: AuthActionState = {};

type DeleteStep = "idle" | "warning" | "confirm";

export function DeleteAccountSection() {
  const [step, setStep] = useState<DeleteStep>("idle");
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    initialState,
  );
  const canSubmit = confirmation === ACCOUNT_DELETION_CONFIRMATION && !pending;

  function handleCancel() {
    setStep("idle");
    setConfirmation("");
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Account
      </h2>

      {step === "idle" ? (
        <div className="mt-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Permanently delete your Hui account and personal data. This action
            cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setStep("warning")}
            className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Delete my account
          </button>
        </div>
      ) : null}

      {step === "warning" ? (
        <div className="mt-2 max-w-lg">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Delete your Hui account?
          </h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              This permanently deletes your account and personal/private
              information.
            </li>
            <li>This cannot be undone.</li>
            <li>You will leave your Hui groups.</li>
            <li>
              Shared group and event history may remain for other members.
            </li>
          </ul>
          <p className="mt-4 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Are you sure you want to continue?
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep("confirm")}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Continue to delete
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="mt-2 max-w-md">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            To permanently delete your account, type{" "}
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
              {ACCOUNT_DELETION_CONFIRMATION}
            </span>{" "}
            below.
          </p>
          <form action={formAction} className="mt-4">
            {state.error ? (
              <p
                className="mb-2 text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
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
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                {pending ? "Deleting account…" : "Delete my account"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleCancel}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
