import { formatSharedDietaryLine } from "@/domain/dietary/display";
import type { GroupSharedDietaryRow } from "@/lib/dietary/types";

type EventDietarySectionProps = {
  eventStatus: string;
  rows: GroupSharedDietaryRow[];
};

export function EventDietarySection({ eventStatus, rows }: EventDietarySectionProps) {
  if (eventStatus === "cancelled") {
    return null;
  }

  return (
    <section className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Dietary considerations
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Shared requirements for this gathering&apos;s group. Private entries are never shown here.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          No dietary information has been shared with this group yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
          {rows.map((row) => (
            <li key={`${row.entryId}-${row.userId}`}>
              {formatSharedDietaryLine(row.displayName, row.label, row.notes)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
