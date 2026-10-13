"use client";

import { formatCompactEventTimeRange } from "@/domain/datetime/timezone";
import type { TimeRecommendation } from "@/domain/scheduling/time-recommendations";
import { PendingButton } from "@/components/ui/pending-button";
import { cn } from "@/lib/ui/cn";

type SuggestedTimesListProps = {
  suggestions: TimeRecommendation[];
  timeZone: string;
  selectedKeys: Set<string>;
  onSelect: (suggestion: TimeRecommendation) => void;
  className?: string;
};

function suggestionKey(suggestion: TimeRecommendation): string {
  return `${suggestion.startsAt}|${suggestion.endsAt ?? ""}`;
}

export function SuggestedTimesList({
  suggestions,
  timeZone,
  selectedKeys,
  onSelect,
  className,
}: SuggestedTimesListProps) {
  if (suggestions.length === 0) {
    return (
      <p className={cn("hui-message-note", className)} role="status">
        No suggested times yet. Add a few times that could work for the group and we&apos;ll help
        narrow them down.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <p className="font-extrabold text-foreground">Suggested times</p>
      <ul className="space-y-2">
        {suggestions.map((suggestion) => {
          const key = suggestionKey(suggestion);
          const added = selectedKeys.has(key);
          return (
            <li
              key={key}
              className="flex min-h-14 flex-col justify-center gap-1 rounded-hui-lg bg-sage-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-extrabold text-foreground">
                  {formatCompactEventTimeRange(
                    suggestion.startsAt,
                    suggestion.endsAt,
                    timeZone,
                  )}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  {suggestion.explanation}
                </p>
              </div>
              <PendingButton
                type="button"
                size="sm"
                variant={added ? "soft" : "primary"}
                disabled={added}
                className="shrink-0"
                onClick={() => onSelect(suggestion)}
              >
                {added ? "Added" : "Use this time"}
              </PendingButton>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
