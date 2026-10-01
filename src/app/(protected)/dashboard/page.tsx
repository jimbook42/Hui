import Link from "next/link";

import { AppShell } from "@/components/app/app-shell";
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

  return (
    <AppShell title="Dashboard">
      <p className="text-zinc-600 dark:text-zinc-400">
        Signed in as{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {profile?.display_name ?? user?.email}
        </span>
        .
      </p>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        This is your authenticated home area. Groups and events will appear here in
        later tickets.
      </p>
      <p className="mt-6 text-sm">
        <Link
          href="/profile"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
        >
          Edit your profile
        </Link>
      </p>
    </AppShell>
  );
}
