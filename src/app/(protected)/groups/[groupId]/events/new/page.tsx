import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { CreateEventProposalFlow } from "@/components/events/create-event-proposal-flow";
import { listContributionCategories } from "@/lib/contributions/queries";
import {
  canProposeEvents,
  groupAllowsEventKind,
} from "@/domain/events/permissions";
import { getGroupDetail } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ groupId: string }>;
};

export default async function NewGroupEventPage({ params }: PageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const detail = await getGroupDetail(supabase, groupId, user!.id);
  if (!detail) {
    notFound();
  }

  const canPropose =
    canProposeEvents(detail.viewerRole, detail.settings) &&
    (groupAllowsEventKind("one_off", detail.settings) ||
      groupAllowsEventKind("recurring", detail.settings));

  if (!canPropose) {
    notFound();
  }

  const { count: activeEventCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId)
    .neq("status", "cancelled");

  const isFirstGroupEvent = (activeEventCount ?? 0) === 0;
  const hostEligibleMembers = detail.members.filter(
    (member) => member.hostingStanding !== "never",
  );
  const contributionCategories = await listContributionCategories(supabase, groupId);

  return (
    <AppShell title={`Propose event — ${detail.name}`}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          href={`/groups/${groupId}/events`}
          className="underline-offset-4 hover:underline"
        >
          Back to events
        </Link>
      </p>
      <div className="mt-8 max-w-lg">
        <CreateEventProposalFlow
          groupId={groupId}
          settings={detail.settings}
          isFirstGroupEvent={isFirstGroupEvent}
          members={hostEligibleMembers}
          contributionCategories={contributionCategories}
        />
      </div>
    </AppShell>
  );
}
