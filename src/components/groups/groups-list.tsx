import Link from "next/link";

import { AvatarStack } from "@/components/hui/avatar-stack";
import { EmptyState } from "@/components/hui/empty-state";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { CalendarIcon, ChevronRightIcon, PeopleIcon } from "@/components/hui/icons";
import { StatusPill } from "@/components/hui/status-pill";
import { formatClockTime, formatShortDay, relativeDayLabel } from "@/domain/datetime/display";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { eventDetailPath } from "@/lib/events/paths";
import { loadHomeData, type HomeEvent } from "@/lib/events/home-data";
import { listGroupPreviews } from "@/lib/groups/previews";
import { devTimed } from "@/lib/perf/dev-server-timing";
import { cn } from "@/lib/ui/cn";

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

const CARD_STYLES = [
  { shape: "hui-shape-organic", blob: "hui-shape-blob-a bg-[var(--blob-sage)]" },
  { shape: "hui-shape-organic-alt", blob: "hui-shape-blob-b bg-[var(--blob-blue)]" },
  { shape: "hui-shape-organic", blob: "hui-shape-blob-a bg-[var(--blob-clay)]" },
] as const;

function nextEventFor(events: HomeEvent[], groupId: string): HomeEvent | null {
  return (
    events
      .filter((event) => event.groupId === groupId && event.bucket !== "past")
      .sort((a, b) => {
        if (a.startsAt && b.startsAt) return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
        if (a.startsAt) return -1;
        if (b.startsAt) return 1;
        return 0;
      })[0] ?? null
  );
}

export async function GroupsList() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }
  const supabase = await getServerSupabase();
  const home = await devTimed("groups-page:list", () =>
    loadHomeData(supabase, user.id, { skipRosters: true }),
  );
  const groups = home.groups;

  if (groups.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        title="No groups yet"
        description="Create a circle for your family or friends, or ask an admin to invite you."
      >
        <HuiLinkButton href="/groups/new" shape="melt">
          Create a group
        </HuiLinkButton>
      </EmptyState>
    );
  }

  const previews = await devTimed("groups-page:previews", () =>
    listGroupPreviews(
      supabase,
      groups.map((group) => group.id),
    ),
  );

  return (
    <ul className="mt-2 space-y-5">
      {groups.map((group, index) => {
        const style = CARD_STYLES[index % CARD_STYLES.length];
        const preview = previews.get(group.id);
        const next = nextEventFor(home.events, group.id);
        const memberCount = preview?.memberCount ?? 0;

        return (
          <li key={group.id} className="hui-rise" style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}>
            <article
              className={cn(
                "group relative bg-surface p-6 hui-shadow-md transition-transform duration-200 hover:-translate-y-0.5",
                style.shape,
              )}
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-16 w-16 shrink-0 items-center justify-center text-2xl font-black text-foreground",
                    style.blob,
                  )}
                >
                  {group.name.trim().charAt(0).toUpperCase() || "G"}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.25rem] font-extrabold leading-tight text-foreground">
                    <Link
                      href={`/groups/${group.id}`}
                      className="hui-focus-ring rounded-md after:absolute after:inset-0 after:z-0 after:rounded-[inherit] after:content-['']"
                    >
                      {group.name}
                    </Link>
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusPill label={roleLabel(group.role)} tone={roleTone(group.role)} />
                  </div>
                </div>
                <ChevronRightIcon size={22} className="mt-1 shrink-0 text-muted-foreground" />
              </div>

              <div className="mt-5 flex items-center gap-3">
                <AvatarStack
                  people={(preview?.members ?? []).map((member) => ({ id: member.userId, name: member.name }))}
                  max={5}
                  size="md"
                  label={`${memberCount} ${memberCount === 1 ? "member" : "members"}`}
                />
                <p className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                  <PeopleIcon size={16} />
                  {memberCount} {memberCount === 1 ? "member" : "members"}
                </p>
              </div>

              <div className="mt-4">
                {next ? (
                  <Link
                    href={eventDetailPath(next.id)}
                    className="hui-focus-ring relative z-10 flex min-h-[3.5rem] items-center gap-3 rounded-hui-lg bg-muted px-4 py-2.5 transition-colors hover:bg-[var(--blob-sage)]"
                  >
                    <CalendarIcon size={20} className="shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold text-foreground">{next.title}</span>
                      <span className="block truncate text-sm font-semibold text-muted-foreground">
                        {next.startsAt
                          ? `${relativeDayLabel(next.startsAt, next.timeZone)} · ${formatShortDay(next.startsAt, next.timeZone)} ${formatClockTime(next.startsAt, next.timeZone)}`
                          : "Time still to be agreed"}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <p className="rounded-hui-lg bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">
                    Nothing planned yet — a good moment to propose something.
                  </p>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

export function GroupsListSkeleton() {
  return (
    <ul className="mt-2 space-y-5" aria-busy="true" aria-label="Loading groups">
      {[0, 1].map((key) => (
        <li key={key} className="hui-shape-organic bg-surface p-6 hui-shadow-md">
          <div className="flex items-center gap-4">
            <div className="hui-skeleton hui-shape-blob-a h-16 w-16 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="hui-skeleton h-5 w-2/3 !rounded-full" />
              <div className="hui-skeleton h-4 w-16 !rounded-full" />
            </div>
          </div>
          <div className="hui-skeleton mt-5 h-10 w-1/2 !rounded-full" />
          <div className="hui-skeleton mt-4 h-14 !rounded-hui-lg" />
        </li>
      ))}
    </ul>
  );
}
