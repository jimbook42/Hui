"use client";

import type { GroupActionState } from "@/app/groups/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";

type GroupFormProps = {
  action: (
    prev: GroupActionState,
    formData: FormData,
  ) => Promise<GroupActionState>;
  submitLabel: string;
  children?: React.ReactNode;
  hiddenFields?: Record<string, string>;
};

export function GroupForm({
  action,
  submitLabel,
  children,
  hiddenFields,
}: GroupFormProps) {
  return (
    <AuthForm action={action} submitLabel={submitLabel} hiddenFields={hiddenFields}>
      {children}
    </AuthForm>
  );
}

export function GroupNameField({ defaultValue }: { defaultValue?: string }) {
  return (
    <AuthField
      label="Group name"
      name="name"
      autoComplete="organization"
      defaultValue={defaultValue}
    />
  );
}
