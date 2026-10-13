import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import { GroupsList, GroupsListSkeleton } from "@/components/groups/groups-list";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { PlusIcon } from "@/components/hui/icons";

export default function GroupsPage() {
  return (
    <AppShell
      title="Your groups"
      subtitle="The circles you gather with. Open one to see who is in it and what is coming up."
    >
      <div className="mb-4 flex">
        <HuiLinkButton href="/groups/new" variant="soft" size="sm" shape="melt">
          <PlusIcon size={16} />
          New group
        </HuiLinkButton>
      </div>

      <Suspense fallback={<GroupsListSkeleton />}>
        <GroupsList />
      </Suspense>
    </AppShell>
  );
}
