import { notFound } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { CreateEventProposalFlow } from "@/components/events/create-event-proposal-flow";
import { listContributionCategories } from "@/lib/contributions/queries";
import {
  canProposeEvents,
  groupAllowsEventKind,
} from "@/domain/events/permissions";
import { getGroupDetail } from "@/lib/groups/queries";
import { loadGroupPlanningContext } from "@/lib/groups/planning-cycle-queries";
import { loadProposalTimeRecommendations } from "@/lib/scheduling/time-recommendations-data";
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
  const planningContext = await loadGroupPlanningContext(
    supabase,
    groupId,
    user!.id,
    detail.name,
    detail.viewerRole,
  );

  const planningTargetDate = planningContext?.cycle.cycleTargetDate ?? null;

  const todayDateOnly = new Date().toISOString().slice(0, 10);
  const timeRecommendations = await loadProposalTimeRecommendations(
    supabase,
    user!.id,
    groupId,
    {
      timeZone: detail.settings.timezone,
      planningTargetDate,
      maybeResponsesEnabled: detail.settings.maybeResponsesEnabled,
      todayDateOnly,
    },
  );

  return (
    <AppShell
      title="Propose a hui"
      subtitle={`With ${detail.name}`}
      back={{ href: `/groups/${groupId}`, label: detail.name }}
      narrow
    >
      <CreateEventProposalFlow
        groupId={groupId}
        groupName={detail.name}
        settings={detail.settings}
        isFirstGroupEvent={isFirstGroupEvent}
        members={hostEligibleMembers}
        contributionCategories={contributionCategories}
        planningCycle={planningContext?.cycle ?? null}
        timeRecommendations={timeRecommendations}
      />
    </AppShell>
  );
}
