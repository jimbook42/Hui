import Link from "next/link";

import { listGroupsForUser } from "@/lib/groups/queries";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { devTimed } from "@/lib/perf/dev-server-timing";

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export async function GroupsList() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }
  const supabase = await getServerSupabase();
  const groups = await devTimed("groups-page:list", () =>
    listGroupsForUser(supabase, user.id),
  );

  if (groups.length === 0) {
    return (
      <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
        You are not in any groups yet.{" "}
        <Link href="/groups/new" className="font-medium underline-offset-4 hover:underline">
          Create one
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="mt-8 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/groups/${group.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
          >
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{group.name}</span>
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              {roleLabel(group.role)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function GroupsListSkeleton() {
  return (
    <ul
      className="mt-8 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
      aria-busy="true"
      aria-label="Loading groups"
    >
      {[0, 1, 2].map((key) => (
        <li key={key} className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="h-5 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-14 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </li>
      ))}
    </ul>
  );
}
