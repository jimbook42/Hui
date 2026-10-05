import { AppShell } from "@/components/app/app-shell";
import { CreateGroupFlow } from "@/components/groups/create-group-flow";
import { HuiSurface } from "@/components/hui/hui-surface";
import { resolveAuthRedirectOrigin } from "@/lib/auth/app-origin";

export default async function NewGroupPage() {
  const appOrigin = await resolveAuthRedirectOrigin();

  return (
    <AppShell
      title="Create a group"
      subtitle="Add people first, then set how this group usually works."
      back={{ href: "/groups", label: "Groups" }}
      narrow
    >
      <HuiSurface padding="lg" shape="organic" elevated>
        <CreateGroupFlow appOrigin={appOrigin} />
      </HuiSurface>
    </AppShell>
  );
}
