import { createGroupAction } from "@/app/groups/actions";
import { AppShell } from "@/components/app/app-shell";
import { GroupForm, GroupNameField } from "@/components/groups/group-form";

export default function NewGroupPage() {
  return (
    <AppShell title="Create a group">
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        You will become the owner with default group settings.
      </p>
      <GroupForm action={createGroupAction} submitLabel="Create group">
        <GroupNameField />
      </GroupForm>
    </AppShell>
  );
}
