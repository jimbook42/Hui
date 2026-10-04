import Link from "next/link";

import { EmptyState } from "@/components/hui/empty-state";
import { StatusPill } from "@/components/hui/status-pill";
import { listGroupsForUser } from "@/lib/groups/queries";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { devTimed } from "@/lib/perf/dev-server-timing";

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

function roleTone(role: string): "neutral" | "active" | "success" {
  if (role === "owner") return "success";
  if (role === "admin") return "active";
  return "neutral";
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
      <EmptyState
        className="mt-8"
        title="No groups yet"
        description="Create a circle for your family or friends, or ask an admin to invite you."
      >
        <Link
          href="/groups/new"
          className="hui-focus-ring inline-flex items-center justify-center rounded-hui-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Create a group
        </Link>
      </EmptyState>
    );
  }

  return (
    <ul className="mt-6 space-y-2">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/groups/${group.id}`}
            className="hui-focus-ring flex items-center justify-between gap-4 rounded-hui-lg border border-border bg-surface px-4 py-3.5 transition hover:bg-muted active:scale-[0.995]"
          >
            <span className="font-medium text-foreground">{group.name}</span>
            <StatusPill label={roleLabel(group.role)} tone={roleTone(group.role)} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function GroupsListSkeleton() {
  return (
    <ul
      className="mt-6 space-y-2"
      aria-busy="true"
      aria-label="Loading groups"
    >
      {[0, 1, 2].map((key) => (
        <li
          key={key}
          className="rounded-hui-lg border border-border bg-surface px-4 py-3.5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}
