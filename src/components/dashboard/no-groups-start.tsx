import { EmptyState } from "@/components/hui/empty-state";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HUI_ONE_LINE_EXPLAINER } from "@/domain/events/hui-explainer";

/** Shown above personal setup for brand-new members with no groups yet. */
export function NoGroupsStart() {
  return (
    <div className="mb-6 space-y-5">
      <section
        aria-labelledby="how-hui-works"
        className="hui-rise rounded-hui-lg bg-muted px-5 py-4"
      >
        <h2 id="how-hui-works" className="text-sm font-extrabold text-foreground">
          How Hui works
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{HUI_ONE_LINE_EXPLAINER}</p>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          Groups are your people. A hui is one plan within that group.
        </p>
      </section>
      <EmptyState
        title="Start with your people"
        description="Create a group for your whānau or friends, or ask an admin to add you. Then you can propose your first hui."
      >
        <HuiLinkButton href="/groups/new" shape="melt">
          Create a group
        </HuiLinkButton>
      </EmptyState>
    </div>
  );
}

export async function NoGroupsStartGate() {
  const { getServerAuthUser, getServerSupabase } = await import("@/lib/auth/server-session");
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }
  const supabase = await getServerSupabase();
  const { count } = await supabase
    .from("group_memberships")
    .select("group_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) > 0) {
    return null;
  }
  return <NoGroupsStart />;
}
