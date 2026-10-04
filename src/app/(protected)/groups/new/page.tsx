import { createGroupAction } from "@/app/groups/actions";
import { AppShell } from "@/components/app/app-shell";
import { GroupForm, GroupNameField } from "@/components/groups/group-form";
import { HuiSurface } from "@/components/hui/hui-surface";

export default function NewGroupPage() {
  return (
    <AppShell
      title="Create a group"
      subtitle="You will become the owner, with sensible default settings you can change later."
      back={{ href: "/groups", label: "Groups" }}
      narrow
    >
      <HuiSurface padding="lg" shape="organic" elevated>
        <GroupForm action={createGroupAction} submitLabel="Create group">
          <GroupNameField />
        </GroupForm>
      </HuiSurface>
    </AppShell>
  );
}
