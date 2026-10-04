"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import type { AuthActionState } from "@/app/auth/actions";
import {
  beginInteraction,
  endInteraction,
  markInteraction,
} from "@/lib/perf/client-interaction-perf";

type AuthFormProps = {
  action: (
    prev: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  submitLabel: string;
  children: React.ReactNode;
  hiddenFields?: Record<string, string>;
  /** Re-fetch server data after a successful action message (e.g. profile save). */
  refreshOnSuccess?: boolean;
};

const initialState: AuthActionState = {};

export function AuthForm({
  action,
  submitLabel,
  children,
  hiddenFields,
  refreshOnSuccess = false,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (pending) {
      markInteraction("form_save", "request-start");
    }
  }, [pending]);

  useEffect(() => {
    if (state.message) {
      markInteraction("form_save", "request-end");
      markInteraction("form_save", "usable-ui");
      endInteraction("form_save");
    }
    if (state.error) {
      endInteraction("form_save");
    }
  }, [state.message, state.error]);

  useEffect(() => {
    if (!refreshOnSuccess || !state.message) {
      return;
    }
    const id = window.setTimeout(() => {
      router.refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refreshOnSuccess, state.message, router]);

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={() => {
        beginInteraction("form_save");
        markInteraction("form_save", "handler-start");
        markInteraction("form_save", "optimistic-ui-visible");
      }}
    >
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      {children}
      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}

export function AuthField({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
      <span>{label}</span>
      <input
        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
      />
    </label>
  );
}
