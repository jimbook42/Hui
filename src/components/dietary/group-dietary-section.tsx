import Link from "next/link";

import { formatSharedDietaryLine } from "@/domain/dietary/display";
import type { GroupSharedDietaryRow } from "@/lib/dietary/types";

type GroupDietarySectionProps = {
  rows: GroupSharedDietaryRow[];
};

export function GroupDietarySection({ rows }: GroupDietarySectionProps) {
  return (
    <section className="hui-card-section">
      <h2 className="hui-type-section text-foreground">
        Dietary information
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Only entries members have chosen to share, either with this group or with all of their groups. Manage yours from{" "}
        <Link
          href="/profile"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          account settings
        </Link>
        .
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No dietary information has been shared with this group.
        </p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm text-foreground">
          {rows.map((row) => (
            <li key={`${row.entryId}-${row.userId}`}>
              {formatSharedDietaryLine(row.displayName, row.label, row.notes)}
              {row.scope === "all_groups" ? (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                  Shared with all groups
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
