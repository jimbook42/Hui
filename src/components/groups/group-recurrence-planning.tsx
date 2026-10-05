import Link from "next/link";

import { HuiLinkButton } from "@/components/hui/hui-button";
import { HuiSurface } from "@/components/hui/hui-surface";
import { CalendarIcon, PlusIcon } from "@/components/hui/icons";
import { formatCadenceLabel } from "@/domain/recurrence/planning-cycle";
import {
  formatNominalPlanningDate,
  shouldShowPlanNextCta,
} from "@/lib/groups/planning-cycle";
import type { GroupPlanningContext } from "@/lib/groups/planning-cycle-queries";

function phaseCopy(context: GroupPlanningContext): { title: string; detail: string } {
  const { cycle, settings } = context;
  const target =
    cycle.nextTargetDate && formatNominalPlanningDate(cycle.nextTargetDate, settings.timezone);
  const opens =
    cycle.planningOpensOn &&
    formatNominalPlanningDate(cycle.planningOpensOn, settings.timezone);

  switch (cycle.phase) {
    case "planning_exists":
      return {
        title: "Planning in progress",
        detail: target ? `Planning around ${target}` : "A hui is being planned.",
      };
    case "hui_confirmed":
      return {
        title: "Next hui confirmed",
        detail: target ? `Upcoming around ${target}` : "The group has a confirmed hui.",
      };
    case "ready_to_plan":
      return {
        title: "Ready to plan the next hui",
        detail: target
          ? `Planning around ${target}`
          : "Start the next gathering when you are ready.",
      };
    case "planning_soon":
      return {
        title: "Next hui to plan",
        detail: opens ? `Planning opens ${opens}` : "The next planning window is coming up.",
      };
    case "not_due":
      return {
        title: "Next hui to plan",
        detail: opens ? `Planning opens ${opens}` : "Nothing due yet.",
      };
    default:
      return { title: "Recurring group", detail: "" };
  }
}

export function GroupRecurrencePlanningCard({
  context,
  compact = false,
}: {
  context: GroupPlanningContext;
  compact?: boolean;
}) {
  if (context.cycle.phase === "not_recurring" || !context.cycle.cadence) {
    return null;
  }

  const copy = phaseCopy(context);
  const cadence = formatCadenceLabel(context.cycle.cadence);
  const proposeHref = `/groups/${context.groupId}/events/new`;

  return (
    <HuiSurface
      padding={compact ? "md" : "lg"}
      shape="organic-alt"
      elevated
      className="hui-rise-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="hui-type-label text-muted-foreground">Recurring</p>
          <p className="mt-1 text-sm font-extrabold text-foreground">{cadence}</p>
          {!compact ? (
            <p className="mt-3 hui-type-section text-foreground">{copy.title}</p>
          ) : null}
          <p className="mt-1 text-sm font-semibold text-muted-foreground">{copy.detail}</p>
        </div>
        <CalendarIcon size={22} className="shrink-0 text-muted-foreground" aria-hidden />
      </div>
      {context.showPlanCta ? (
        <div className="mt-4">
          <HuiLinkButton href={proposeHref} size="touch" variant="secondary">
            <PlusIcon size={18} />
            Plan next hui
          </HuiLinkButton>
        </div>
      ) : context.canPropose && cycleAllowsManualPropose(context) ? (
        <p className="mt-4 text-sm font-semibold text-muted-foreground">
          <Link href={proposeHref} className="hui-link">
            Propose a hui
          </Link>{" "}
          when you are ready.
        </p>
      ) : null}
    </HuiSurface>
  );
}

function cycleAllowsManualPropose(context: GroupPlanningContext): boolean {
  return (
    !shouldShowPlanNextCta(context.cycle) &&
    context.cycle.phase !== "planning_exists" &&
    context.cycle.phase !== "hui_confirmed"
  );
}

export function DashboardRecurringPlanning({
  contexts,
}: {
  contexts: GroupPlanningContext[];
}) {
  const visible = contexts.filter(
    (ctx) => ctx.cycle.phase !== "not_recurring" && ctx.cycle.cadence,
  );
  if (visible.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="recurring-planning" className="space-y-4">
      <h2 id="recurring-planning" className="hui-type-section text-foreground">
        Recurring groups
      </h2>
      <ul className="space-y-4">
        {visible.map((context) => (
          <li key={context.groupId}>
            <div className="mb-2 text-sm font-extrabold text-foreground">{context.groupName}</div>
            <GroupRecurrencePlanningCard context={context} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}
