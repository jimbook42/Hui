import { AppShell } from "@/components/app/app-shell";
import { CreateGroupFlow } from "@/components/groups/create-group-flow";
import { HuiSurface } from "@/components/hui/hui-surface";

export default async function NewGroupPage() {
  return (
    <AppShell
      title="Create a group"
      subtitle="Name the group, then plan your first gathering."
      back={{ href: "/groups", label: "Groups" }}
      narrow
    >
      <HuiSurface padding="lg" shape="organic" elevated>
        <CreateGroupFlow />
      </HuiSurface>
    </AppShell>
  );
}
