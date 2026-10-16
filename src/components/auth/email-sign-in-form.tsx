"use client";

import { signInAction } from "@/app/auth/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";

type EmailSignInFormProps = {
  next: string;
};

export function EmailSignInForm({ next }: EmailSignInFormProps) {
  return (
    <AuthForm
      action={signInAction}
      submitLabel="Sign in"
      hiddenFields={{ next }}
      showSlowSignInNotice
      clearErrorOnFieldChange
    >
      <AuthField label="Email" name="email" type="email" autoComplete="email" />
      <AuthField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />
    </AuthForm>
  );
}
