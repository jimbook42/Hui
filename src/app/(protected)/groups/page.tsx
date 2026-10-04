import Link from "next/link";
import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import { GroupsList, GroupsListSkeleton } from "@/components/groups/groups-list";

export default function GroupsPage() {
  return (
    <AppShell title="Your groups">
      <div className="flex items-start justify-between gap-4">
        <p className="hui-type-supporting max-w-prose">
          Gathering circles you belong to. Tap a group to plan the next hui.
        </p>
        <Link
          href="/groups/new"
          className="hui-focus-ring shrink-0 inline-flex items-center justify-center rounded-hui-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
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
