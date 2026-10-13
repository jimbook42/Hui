import type { GroupHostHistory } from "@/lib/hosts/types";

type GroupHostHistorySectionProps = {
  history: GroupHostHistory;
};

export function GroupHostHistorySection({ history }: GroupHostHistorySectionProps) {
  if (history.entries.length === 0) {
    return null;
  }

  return (
    <section className="hui-card-section">
      <h2 className="hui-type-section text-foreground">Hosting history</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Counts from accepted hosts on confirmed and completed events in this group. Cancelled events
        are not included. This is factual history, not a scoreboard.
      </p>
      <ul className="mt-4 space-y-1 text-sm text-foreground">
        {history.entries.map((entry) => (
          <li key={entry.userId}>
            {entry.displayName} — hosted {entry.count} gathering{entry.count === 1 ? "" : "s"}
          </li>
        ))}
      </ul>
    </section>
  );
}
