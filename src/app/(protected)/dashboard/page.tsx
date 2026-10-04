import Link from "next/link";

import { AppShell } from "@/components/app/app-shell";
import { HuiSurface } from "@/components/hui/hui-surface";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? user?.email ?? "there";

  return (
    <AppShell title="Home">
      <HuiSurface elevated className="space-y-3">
        <p className="hui-type-display text-foreground">Kia ora, {displayName}</p>
        <p className="hui-type-body text-muted-foreground">
          Hui proposes, coordinates, and remembers. Your groups decide when and how you
          gather.
        </p>
      </HuiSurface>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/groups"
          className="hui-focus-ring rounded-hui-lg border border-border bg-surface px-4 py-4 transition hover:bg-muted"
        >
          <p className="hui-type-section text-foreground">Your groups</p>
          <p className="hui-type-supporting mt-1">
            See circles, members, and upcoming planning.
          </p>
        </Link>
        <Link
          href="/notifications"
          className="hui-focus-ring rounded-hui-lg border border-border bg-surface px-4 py-4 transition hover:bg-muted"
        >
          <p className="hui-type-section text-foreground">Notifications</p>
          <p className="hui-type-supporting mt-1">
            What needs your attention across gatherings.
          </p>
        </Link>
      </div>

      <p className="mt-8 hui-type-supporting">
        Event-oriented dashboard improvements are planned in{" "}
        <span className="font-medium text-foreground">HUI-026C</span>.
      </p>
    </AppShell>
  );
}
