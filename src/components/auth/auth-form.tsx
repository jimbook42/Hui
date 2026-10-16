"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";

import type { AuthActionState } from "@/app/auth/actions";
import { AuthSlowActionNotice } from "@/components/auth/auth-slow-action-notice";
import {
  beginInteraction,
  endInteraction,
  markInteraction,
} from "@/lib/perf/client-interaction-perf";
import { cn } from "@/lib/ui/cn";

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
  /** Show slow-sign-in messaging while the action is pending. */
  showSlowSignInNotice?: boolean;
  /** Hide the inline error while the user edits a field or resubmits. */
  clearErrorOnFieldChange?: boolean;
};

const initialState: AuthActionState = {};

type AuthFormContextValue = {
  fields: AuthActionState["fields"];
  passwordFieldKey: string;
  onFieldEdit?: () => void;
};

const AuthFormFieldContext = createContext<AuthFormContextValue | null>(null);

export function AuthForm({
  action,
  submitLabel,
  children,
  hiddenFields,
  refreshOnSuccess = false,
  showSlowSignInNotice = false,
  clearErrorOnFieldChange = false,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [errorSuppressed, setErrorSuppressed] = useState(false);
  const wasPendingRef = useRef(false);
  const router = useRouter();
  const formInstanceId = useId();
  const passwordFieldKey = state.error
    ? `${formInstanceId}-pw-${state.error}`
    : `${formInstanceId}-pw`;

  useEffect(() => {
    if (wasPendingRef.current && !pending && clearErrorOnFieldChange) {
      setErrorSuppressed(false);
    }
    wasPendingRef.current = pending;
  }, [pending, clearErrorOnFieldChange]);

  const visibleError =
    state.error && !(clearErrorOnFieldChange && errorSuppressed) ? state.error : undefined;

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
    if (visibleError) {
      endInteraction("form_save");
    }
  }, [state.message, visibleError]);

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
        if (clearErrorOnFieldChange) {
          setErrorSuppressed(true);
        }
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
      <AuthFormFieldContext.Provider
        value={{
          fields: state.fields,
          passwordFieldKey,
          onFieldEdit: clearErrorOnFieldChange
            ? () => {
                setErrorSuppressed(true);
              }
            : undefined,
        }}
      >
        {children}
      </AuthFormFieldContext.Provider>
      {visibleError ? (
        <p className="hui-message-error" role="alert">
          {visibleError}
        </p>
      ) : null}
      {state.message ? (
        <p className="hui-message-success" role="status">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="hui-btn hui-btn-primary rounded-full hui-focus-ring w-full"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
      {showSlowSignInNotice ? <AuthSlowActionNotice pending={pending} /> : null}
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
  onPasteBlocked,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  /** Block paste on confirm-email fields to reduce typos. */
  onPasteBlocked?: boolean;
}) {
  const ctx = useContext(AuthFormFieldContext);
  const preserved = ctx?.fields;
  const preservedValue =
    name === "display_name"
      ? preserved?.display_name
      : name === "email"
        ? preserved?.email
        : undefined;
  const resolvedDefault = preservedValue ?? defaultValue;
  const remountKey =
    name === "password"
      ? ctx?.passwordFieldKey
      : `${name}-${resolvedDefault ?? "empty"}`;

  return (
    <label className="hui-label">
      <span>{label}</span>
      <input
        key={remountKey}
        className={cn(
          "hui-input",
          type === "email" && "text-[0.875rem] sm:text-base",
        )}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={name === "password" ? undefined : resolvedDefault}
        onPaste={
          onPasteBlocked
            ? (event) => {
                event.preventDefault();
              }
            : undefined
        }
        onChange={() => {
          ctx?.onFieldEdit?.();
        }}
      />
    </label>
  );
}
