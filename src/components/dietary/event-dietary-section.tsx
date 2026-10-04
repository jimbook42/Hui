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
    <section className="hui-card-section">
      <h2 className="hui-type-section text-foreground">
        Dietary considerations
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Shared requirements for this gathering&apos;s group. Private entries are never shown here.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No dietary information has been shared with this group yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-1 text-sm text-foreground">
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
