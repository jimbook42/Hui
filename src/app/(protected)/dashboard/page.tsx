import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import { InstallHuiCard } from "@/components/pwa/install-hui";
import { PushNotificationsOnboardCard } from "@/components/pwa/push-notifications-onboard";
import { DashboardEvents, DashboardEventsSkeleton } from "@/components/home/home-sections";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { getVapidPublicKey } from "@/lib/push/config";

async function Greeting() {
  const user = await getServerAuthUser();
  const supabase = await getServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? user?.email ?? "there";
  const firstName = displayName.split(/\s+/)[0] ?? displayName;

  return <GreetingText name={firstName} />;
}

function GreetingText({ name }: { name?: string }) {
  return (
    <header className="hui-rise pb-6 pt-2">
      <h1 className="hui-type-hero text-foreground">
        Kia ora{name ? `, ${name}` : ""}
      </h1>
      <p className="mt-1.5 text-lg font-bold hui-type-clay">Ready for this week&apos;s hui?</p>
    </header>
  );
}

export default function DashboardPage() {
  const vapidPublicKey = getVapidPublicKey();
  const pushConfigured = vapidPublicKey !== null;

  return (
    <AppShell title="Home" hideTitle>
      <Suspense fallback={<GreetingText />}>
        <Greeting />
      </Suspense>
      <InstallHuiCard />
      <PushNotificationsOnboardCard
        pushConfigured={pushConfigured}
        vapidPublicKey={vapidPublicKey}
      />
      <Suspense fallback={<DashboardEventsSkeleton />}>
        <DashboardEvents />
      </Suspense>
    </AppShell>
  );
}
