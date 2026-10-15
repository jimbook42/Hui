"use client";

import { deleteGroupAction } from "@/app/groups/actions";
import { AuthField, AuthForm } from "@/components/auth/auth-form";

export function DeleteGroupForm({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  return (
    <AuthForm
      action={deleteGroupAction}
      submitLabel="Delete group permanently"
      hiddenFields={{ group_id: groupId }}
    >
      <p className="text-sm text-muted-foreground">
        This deletes the group, its hui, who&apos;s bringing what, and its invite links. This
        can&apos;t be undone.
      </p>
      <AuthField
        label={`Type “${groupName}” to confirm`}
        name="confirm_name"
        autoComplete="off"
        required
      />
    </AuthForm>
  );
}
