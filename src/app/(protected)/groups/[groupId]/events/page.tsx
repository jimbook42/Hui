import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import { EventsOverview, EventsOverviewSkeleton } from "@/components/home/home-sections";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { getGroupDetail } from "@/lib/groups/queries";

type PageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function GroupEventsPage({ params }: PageProps) {
  const { groupId } = await params;
  const user = await getServerAuthUser();
  const supabase = await getServerSupabase();

  const detail = await getGroupDetail(supabase, groupId, user!.id);
  if (!detail) {
    notFound();
  }

  return (
    <AppShell
      title={`${detail.name} events`}
      subtitle="Everything planned, proposed and past for this group."
      back={{ href: `/groups/${groupId}`, label: detail.name }}
    >
      <Suspense fallback={<EventsOverviewSkeleton />}>
        <EventsOverview groupId={groupId} />
      </Suspense>
    </AppShell>
  );
}
