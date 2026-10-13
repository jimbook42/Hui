import type { GroupContributionHistory } from "@/lib/contributions/types";

type GroupContributionHistoryProps = {
  history: GroupContributionHistory;
};

export function GroupContributionHistorySection({ history }: GroupContributionHistoryProps) {
  if (history.entries.length === 0) {
    return null;
  }

  return (
    <section className="hui-card-section">
      <h2 className="hui-type-section text-foreground">Contribution history</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Counts from confirmed and completed events in this group. No scores or rankings beyond what the
        group can see here.
      </p>
      <ul className="mt-4 space-y-1 text-sm text-foreground">
        {history.entries.map((entry) => (
          <li key={entry.userId}>
            {entry.displayName} — {entry.count} contribution{entry.count === 1 ? "" : "s"}
          </li>
        ))}
      </ul>
    </section>
  );
}
