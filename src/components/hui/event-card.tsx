import Link from "next/link";

import { AvatarStack } from "@/components/hui/avatar-stack";
import { EventDateBadge } from "@/components/hui/event-date-badge";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { BowlIcon, CheckIcon, ClockIcon, PinIcon, SparkIcon } from "@/components/hui/icons";
import { StatusPill, type StatusPillTone } from "@/components/hui/status-pill";
import {
  formatClockTime,
  formatShortDay,
  formatTimeSpan,
  relativeDayLabel,
} from "@/domain/datetime/display";
import { viewerStatusLabel } from "@/domain/events/home";
import { eventStatusLabel } from "@/lib/events/labels";
import { eventAttentionPath, eventDetailPath, participantRespondPath } from "@/lib/events/paths";
import type { HomeEvent } from "@/lib/events/home-data";
import { cn } from "@/lib/ui/cn";

type EventCardProps = {
  event: HomeEvent;
  variant?: "featured" | "standard";
  tone?: "primary" | "secondary" | "sage";
  className?: string;
};

function statusPillFor(event: HomeEvent): { label: string; tone: StatusPillTone } | null {
  if (event.status === "cancelled") {
    return { label: "Cancelled", tone: "muted" };
  }
  if (event.status === "completed") {
    return { label: "Done", tone: "muted" };
  }
  if (event.viewerState === "yes") {
    return { label: viewerStatusLabel("yes"), tone: "success" };
  }
  if (event.viewerState === "maybe") {
    return { label: viewerStatusLabel("maybe"), tone: "clay" };
  }
  if (event.viewerState === "no") {
    return { label: viewerStatusLabel("no"), tone: "muted" };
  }
  if (event.attention === "respond") {
    return { label: viewerStatusLabel("pending"), tone: "clay" };
  }
  return null;
}

function peopleSummary(event: HomeEvent): string {
  if (!event.counts) {
    return "";
  }
  const { yes, maybe, pending } = event.counts;
  if (yes === 0 && maybe === 0) {
    return pending > 0 ? "No replies yet" : "Nobody is coming yet";
  }
  const parts = [`${yes} coming`];
  if (maybe > 0 && event.maybeResponsesEnabled) {
    parts.push(`${maybe} maybe`);
  }
  return parts.join(" · ");
}

/**
 * Gathering card for Home and the Hui list: organic date blob, place + time, the people
 * around it, and (when it matters) the one next action. The whole card is one tap target.
 */
export function EventCard({ event, variant = "standard", tone = "primary", className }: EventCardProps) {
  const featured = variant === "featured";
  const pill = statusPillFor(event);
  const coming = (event.roster?.members ?? [])
    .filter((member) => member.response === "yes")
    .map((member) => ({ id: member.userId, name: member.displayName }));
  const summary = peopleSummary(event);
  const planning = event.bucket === "planning" || event.attention === "respond";
  const timeLine = event.startsAt
    ? `${formatShortDay(event.startsAt, event.timeZone)} · ${
        featured
          ? formatTimeSpan(event.startsAt, event.endsAt, event.timeZone)
          : formatClockTime(event.startsAt, event.timeZone)
      }`
    : "Time still to be agreed";
  const when = event.startsAt && event.bucket !== "past" ? relativeDayLabel(event.startsAt, event.timeZone) : null;

  return (
    <article
      className={cn(
        "group relative bg-surface hui-shadow-md transition-transform duration-200 hover:-translate-y-0.5",
        featured ? "hui-shape-organic p-6" : "rounded-hui-xl p-5",
        className,
      )}
    >
      <div className="flex gap-4">
        <EventDateBadge
          startsAt={event.startsAt}
          timeZone={event.timeZone}
          tone={tone}
          size={featured ? "lg" : "md"}
          fallbackLabel="TBC"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="hui-type-label truncate text-muted-foreground">{event.groupName}</p>
            {when ? (
              <span className="rounded-full bg-clay-soft px-2 py-0.5 text-[0.6875rem] font-extrabold text-foreground">
                {when}
              </span>
            ) : null}
          </div>
          <h3 className={cn("mt-1 font-extrabold leading-tight text-foreground", featured ? "text-[1.375rem]" : "text-[1.0625rem]")}>
            <Link
              href={eventDetailPath(event.id)}
              className="hui-focus-ring rounded-md after:absolute after:inset-0 after:z-0 after:rounded-[inherit] after:content-['']"
            >
              {event.title}
            </Link>
          </h3>
          <ul className="mt-2 space-y-1 text-sm font-semibold text-muted-foreground">
            <li className="flex items-start gap-2">
              <ClockIcon size={16} className="mt-0.5 shrink-0" />
              <span className="min-w-0">{timeLine}</span>
            </li>
            <li className="flex items-start gap-2">
              <PinIcon size={16} className="mt-0.5 shrink-0" />
              <span className="min-w-0 truncate">{event.location ?? "Place still being worked out"}</span>
            </li>
            {event.hostName && featured ? (
              <li className="flex items-start gap-2">
                <SparkIcon size={16} className="mt-0.5 shrink-0" />
                <span className="min-w-0 truncate">Hosted by {event.hostName}</span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {coming.length > 0 || summary ? (
        <div className="mt-4 flex items-center gap-3">
          <AvatarStack
            people={coming}
            size={featured ? "md" : "sm"}
            max={featured ? 6 : 4}
            label={summary}
          />
          {summary ? <p className="text-sm font-bold text-foreground">{summary}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {pill ? (
          <StatusPill
            label={pill.label}
            tone={pill.tone}
            icon={event.viewerState === "yes" ? <CheckIcon size={13} strokeWidth={3} /> : undefined}
          />
        ) : null}
        {planning && event.status !== "confirmed" ? (
          <StatusPill label={eventStatusLabel(event.status)} tone="blue" />
        ) : null}
        {event.contributionsOpen && event.contributionsOpen > 0 ? (
          <StatusPill
            label={`${event.contributionsOpen} to bring`}
            tone="neutral"
            icon={<BowlIcon size={14} />}
          />
        ) : null}

        {event.attention === "respond" ? (
          <HuiLinkButton
            href={participantRespondPath(event.id)}
            size="sm"
            shape="melt"
            className="relative z-10 ml-auto"
          >
            Reply
          </HuiLinkButton>
        ) : null}
        {event.attention === "host" ? (
          <HuiLinkButton
            href={eventAttentionPath(event.id, "host")}
            size="sm"
            shape="melt"
            className="relative z-10 ml-auto"
          >
            Hosting request
          </HuiLinkButton>
        ) : null}
        {event.attention === "confirm" ? (
          <HuiLinkButton
            href={eventAttentionPath(event.id, "confirm")}
            size="sm"
            shape="melt"
            className="relative z-10 ml-auto"
          >
            Review times
          </HuiLinkButton>
        ) : null}
        {event.attention === "contribute" ? (
          <HuiLinkButton
            href={eventAttentionPath(event.id, "contribute")}
            size="sm"
            shape="melt"
            className="relative z-10 ml-auto"
          >
            Pick something
          </HuiLinkButton>
        ) : null}
      </div>
    </article>
  );
}

export function EventCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className={cn("bg-surface p-5 hui-shadow-md", featured ? "hui-shape-organic" : "rounded-hui-xl")}
      aria-hidden="true"
    >
      <div className="flex gap-4">
        <div className={cn("hui-skeleton shrink-0 hui-shape-blob-a", featured ? "h-24 w-24" : "h-[4.5rem] w-[4.5rem]")} />
        <div className="min-w-0 flex-1 space-y-2.5 pt-1">
          <div className="hui-skeleton h-3 w-24 !rounded-full" />
          <div className="hui-skeleton h-5 w-4/5 !rounded-full" />
          <div className="hui-skeleton h-3.5 w-3/5 !rounded-full" />
          <div className="hui-skeleton h-3.5 w-2/5 !rounded-full" />
        </div>
      </div>
    </div>
  );
}
