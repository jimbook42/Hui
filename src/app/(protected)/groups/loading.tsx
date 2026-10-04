import { AppShell } from "@/components/app/app-shell";
import { GroupsListSkeleton } from "@/components/groups/groups-list";

export default function GroupsLoading() {
  return (
    <AppShell title="Your groups">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-busy="true">
          Loading groups…
        </p>
        <div className="h-9 w-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <GroupsListSkeleton />
    </AppShell>
  );
}
