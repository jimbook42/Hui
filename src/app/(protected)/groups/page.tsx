import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import { GroupsList, GroupsListSkeleton } from "@/components/groups/groups-list";

export default function GroupsPage() {
  return (
    <AppShell title="Your groups">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Groups you belong to right now.
        </p>
        <Link
          href="/groups/new"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New group
        </Link>
      </div>

      <Suspense fallback={<GroupsListSkeleton />}>
        <GroupsList />
      </Suspense>
    </AppShell>
  );
}
