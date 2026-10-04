import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { EmptyState } from "@/components/hui/empty-state";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { ChevronRightIcon } from "@/components/hui/icons";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { loadHomeData } from "@/lib/events/home-data";

/**
 * "Create Hui" entry when the viewer can propose in more than one group: pick the group,
 * then the existing staged proposal flow takes over. No new product behaviour.
 */
export default async function ChooseGroupForNewEventPage() {
  const user = await getServerAuthUser();
  const supabase = await getServerSupabase();
  const { proposableGroups } = await loadHomeData(supabase, user!.id);

  if (proposableGroups.length === 1) {
    redirect(`/groups/${proposableGroups[0].id}/events/new`);
  }

  return (
    <AppShell
      title="Who is this hui with?"
      subtitle="Pick the group you want to gather. You will name it and propose a time next."
      back={{ href: "/dashboard", label: "Home" }}
      narrow
    >
      {proposableGroups.length === 0 ? (
        <EmptyState
          title="No group to propose in yet"
          description="You can propose a hui in any group where the settings allow you to. Create a group to get started."
        >
          <HuiLinkButton href="/groups/new" shape="melt">
            Create a group
          </HuiLinkButton>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {proposableGroups.map((group, index) => (
            <li key={group.id} className="hui-rise" style={{ animationDelay: `${index * 50}ms` }}>
              <Link
                href={`/groups/${group.id}/events/new`}
                className="hui-focus-ring flex min-h-[4.5rem] items-center gap-4 rounded-hui-xl bg-surface p-4 hui-shadow-md transition-transform active:scale-[0.99]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--blob-sage)] text-lg font-black text-foreground hui-shape-blob-a"
                >
                  {group.name.trim().charAt(0).toUpperCase() || "G"}
                </span>
                <span className="min-w-0 flex-1 truncate text-lg font-extrabold text-foreground">
                  {group.name}
                </span>
                <ChevronRightIcon size={20} className="shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
