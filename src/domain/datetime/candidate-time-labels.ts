import { formatCompactEventTimeRange, formatEventTimeRange } from "@/domain/datetime/timezone";

type CandidateLike = {
  id: string;
  startsAt: string;
  endsAt: string | null;
};

/** Pre-format on the server so client scheduling UI does not re-run Intl during hydration. */
export function buildEventTimeLabelMap(
  candidates: ReadonlyArray<CandidateLike>,
  timeZone: string,
  variant: "range" | "compact" = "range",
): Record<string, string> {
  const format =
    variant === "compact" ? formatCompactEventTimeRange : formatEventTimeRange;
  return Object.fromEntries(
    candidates.map((candidate) => [
      candidate.id,
      format(candidate.startsAt, candidate.endsAt, timeZone),
    ]),
  );
}
