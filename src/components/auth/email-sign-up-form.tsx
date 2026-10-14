"use client";

import { useMemo, useState } from "react";

import { signUpAction } from "@/app/auth/actions";
import { AuthForm, AuthField } from "@/components/auth/auth-form";
import {
  evaluatePasswordRules,
  passwordsMeetRules,
} from "@/domain/auth/password-rules";

type EmailSignUpFormProps = {
  next: string;
};

export function EmailSignUpForm({ next }: EmailSignUpFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const rules = useMemo(
    () => evaluatePasswordRules(password, confirmPassword),
    [password, confirmPassword],
  );

  return (
    <AuthForm
      action={signUpAction}
      submitLabel="Create account"
      hiddenFields={{ next }}
      showSlowSignInNotice
    >
      <AuthField label="Display name" name="display_name" autoComplete="name" />
      <AuthField label="Email" name="email" type="email" autoComplete="email" />
      <AuthField
        label="Confirm email"
        name="email_confirm"
        type="email"
        autoComplete="off"
        onPasteBlocked
      />
      <label className="hui-label">
        <span>Password</span>
        <input
          className="hui-input"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="hui-label">
        <span>Confirm password</span>
        <input
          className="hui-input"
          name="password_confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </label>
      <ul className="space-y-1 text-xs text-muted-foreground" aria-live="polite">
        <li className={rules.minLength ? "text-success" : undefined}>
          {rules.minLength ? "✓" : "○"} At least 8 characters
        </li>
        <li className={rules.matches ? "text-success" : undefined}>
          {rules.matches ? "✓" : "○"} Passwords match
        </li>
      </ul>
      <input
        type="hidden"
        name="password_rules_ok"
        value={passwordsMeetRules(password, confirmPassword) ? "1" : "0"}
      />
    </AuthForm>
  );
}
