import Link from "next/link";

import { AppShell } from "@/components/app/app-shell";
import { listGroupsForUser } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const groups = await listGroupsForUser(supabase, user!.id);

  return (
    <AppShell title="Your groups">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Groups you belong to right now.
        </p>
        <Link
          href="/groups/new"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New group
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          You are not in any groups yet.{" "}
          <Link href="/groups/new" className="font-medium underline-offset-4 hover:underline">
            Create one
          </Link>
          .
        </p>
      ) : (
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
      )}
    </AppShell>
  );
}
