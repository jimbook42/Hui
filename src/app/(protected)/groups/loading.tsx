import { AppShell } from "@/components/app/app-shell";
import { GroupsListSkeleton } from "@/components/groups/groups-list";

export default function GroupsLoading() {
  return (
    <AppShell title="Your groups">
      <GroupsListSkeleton />
    </AppShell>
  );
}
