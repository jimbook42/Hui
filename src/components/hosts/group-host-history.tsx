import type { GroupHostHistory } from "@/lib/hosts/types";

type GroupHostHistorySectionProps = {
  history: GroupHostHistory;
};

export function GroupHostHistorySection({ history }: GroupHostHistorySectionProps) {
  if (history.entries.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Hosting history</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Counts from accepted hosts on confirmed and completed events in this group. Cancelled events
        are not included. This is factual history, not a scoreboard.
      </p>
      <ul className="mt-4 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
        {history.entries.map((entry) => (
          <li key={entry.userId}>
            {entry.displayName} — hosted {entry.count} gathering{entry.count === 1 ? "" : "s"}
          </li>
        ))}
      </ul>
    </section>
  );
}
