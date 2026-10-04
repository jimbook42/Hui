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
  const firstName = displayName.split(/\s+/)[0] ?? displayName;

  return (
    <AppShell title="Home">
      <header className="space-y-1">
        <p className="hui-type-display text-foreground">Kia ora, {firstName}</p>
        <p className="hui-type-supporting">What needs your attention in your groups?</p>
      </header>

      <HuiSurface elevated className="mt-6 space-y-3">
        <p className="hui-type-body text-muted-foreground">
          Hui proposes, coordinates, and remembers. Your groups decide when and how you
          gather.
        </p>
      </HuiSurface>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/groups"
          className="hui-focus-ring rounded-hui-xl border border-border bg-surface px-4 py-4 hui-shadow-sm transition hover:bg-muted/60"
        >
          <p className="hui-type-section text-primary">Your groups</p>
          <p className="hui-type-supporting mt-1">
            Circles, members, and planning for the next hui.
          </p>
        </Link>
        <Link
          href="/notifications"
          className="hui-focus-ring rounded-hui-xl border border-border bg-surface px-4 py-4 hui-shadow-sm transition hover:bg-muted/60"
        >
          <p className="hui-type-section text-primary">Notifications</p>
          <p className="hui-type-supporting mt-1">
            Updates that need a response or a quick look.
          </p>
        </Link>
      </div>

      <p className="mt-8 hui-type-supporting">
        Upcoming-hui cards and map-style discovery are planned in{" "}
        <span className="font-medium text-foreground">HUI-026C</span>.
      </p>
    </AppShell>
  );
}
