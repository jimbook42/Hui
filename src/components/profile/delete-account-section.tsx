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
    <div className="pt-8">
      <h3 className="text-sm font-extrabold text-foreground">
        Delete account
      </h3>

      {step === "idle" ? (
        <div className="mt-2">
          <p className="text-sm text-muted-foreground">
            Permanently delete your Hui account and personal data. This action
            cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setStep("warning")}
            className="hui-btn hui-btn-danger rounded-full hui-focus-ring mt-4"
          >
            Delete my account
          </button>
        </div>
      ) : null}

      {step === "warning" ? (
        <div className="mt-2 max-w-lg">
          <h3 className="text-sm font-extrabold text-foreground">
            Delete your Hui account?
          </h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
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
          <p className="mt-4 text-sm font-medium text-foreground">
            Are you sure you want to continue?
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep("confirm")}
              className="hui-btn hui-btn-danger rounded-full hui-focus-ring"
            >
              Continue to delete
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="mt-2 max-w-md">
          <p className="text-sm text-muted-foreground">
            To permanently delete your account, type{" "}
            <span className="font-mono font-semibold text-foreground">
              {ACCOUNT_DELETION_CONFIRMATION}
            </span>{" "}
            below.
          </p>
          <form action={formAction} className="mt-4">
            {state.error ? (
              <p
                className="hui-message-error mb-2"
                role="alert"
              >
                {state.error}
              </p>
            ) : null}
            <label className="hui-label">
              Type {ACCOUNT_DELETION_CONFIRMATION} to confirm
              <input
                type="text"
                name="confirmation"
                autoComplete="off"
                disabled={pending}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="hui-input"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="hui-btn hui-btn-danger rounded-full hui-focus-ring"
              >
                {pending ? "Deleting account…" : "Delete my account"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleCancel}
                className="hui-btn hui-btn-secondary rounded-full hui-focus-ring"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
