import type { GroupContributionHistory } from "@/lib/contributions/types";

type GroupContributionHistoryProps = {
  history: GroupContributionHistory;
};

export function GroupContributionHistorySection({ history }: GroupContributionHistoryProps) {
  if (history.entries.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Contribution history</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Counts from confirmed and completed events in this group. No scores or rankings beyond what the
        group can see here.
      </p>
      <ul className="mt-4 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
        {history.entries.map((entry) => (
          <li key={entry.userId}>
            {entry.displayName} — {entry.count} contribution{entry.count === 1 ? "" : "s"}
          </li>
        ))}
      </ul>
    </section>
  );
}
