import Link from "next/link";

import { formatSharedDietaryLine } from "@/domain/dietary/display";
import type { GroupSharedDietaryRow } from "@/lib/dietary/types";

type GroupDietarySectionProps = {
  rows: GroupSharedDietaryRow[];
};

export function GroupDietarySection({ rows }: GroupDietarySectionProps) {
  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Dietary information
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Only entries members have explicitly shared with this group. Manage yours from{" "}
        <Link
          href="/profile"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
        >
          account settings
        </Link>
        .
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          No dietary information has been shared with this group.
        </p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm text-zinc-800 dark:text-zinc-200">
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
