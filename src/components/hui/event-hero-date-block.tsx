"use client";

import { useCallback } from "react";

import type { EventHeroDateCopy } from "@/domain/datetime/event-hero-dates";
import { relativeDayLabel } from "@/domain/datetime/display";
import { ClockIcon } from "@/components/hui/icons";
import { EventDateBadge } from "@/components/hui/event-date-badge";
import { HydrationClientOnlyText } from "@/components/hui/hydration-deferred-text";

type EventHeroDateBlockProps = {
  copy: EventHeroDateCopy;
  badgeTone: "primary" | "sage";
  showProposedHint: boolean;
};

export function EventHeroDateBlock({
  copy,
  badgeTone,
  showProposedHint,
}: EventHeroDateBlockProps) {
  const computeWhen = useCallback(
    () => relativeDayLabel(copy.startsAt, copy.timeZone),
    [copy.startsAt, copy.timeZone],
  );

  return (
    <>
      <div className="flex items-center gap-4">
        <EventDateBadge
          parts={copy.badge}
          size="lg"
          tone={badgeTone}
          fallbackLabel="TBC"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold leading-tight text-foreground">{copy.longDay}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-base font-bold text-muted-foreground">
            <ClockIcon size={17} className="shrink-0" />
            <span>{copy.timeSpan}</span>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2">
            {copy.showRelativeWhen ? (
              <span className="rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-extrabold text-foreground">
                <HydrationClientOnlyText compute={computeWhen} />
              </span>
            ) : null}
            {showProposedHint ? (
              <span className="text-sm font-semibold text-muted-foreground">
                Proposed time — not confirmed yet
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </>
  );
}
