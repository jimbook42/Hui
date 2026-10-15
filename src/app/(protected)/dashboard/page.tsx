import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";
import { NoGroupsStartGate } from "@/components/dashboard/no-groups-start";
import { PersonalSetupPrompt } from "@/components/dashboard/personal-setup-prompt";
import { InstallHuiCard } from "@/components/pwa/install-hui";
import { PushNotificationsOnboardCard } from "@/components/pwa/push-notifications-onboard";
import { DashboardEvents, DashboardEventsSkeleton } from "@/components/home/home-sections";
import { dashboardHuiGreetingLine } from "@/domain/events/dashboard-greeting";
import { todayDateOnlyInTimeZone } from "@/lib/groups/planning-cycle";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { loadHomeData, splitHomeEvents } from "@/lib/events/home-data";
import { getVapidPublicKey } from "@/lib/push/config";

async function Greeting() {
  const user = await getServerAuthUser();
  const supabase = await getServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();

  const displayName = profile?.display_name?.trim() ?? user?.email ?? "there";

  const { events } = await loadHomeData(supabase, user!.id);
  const sections = splitHomeEvents(events);
  const nextEvent =
    sections.attention[0] ?? sections.upcoming[0] ?? sections.planning[0] ?? null;
  const timeZone = nextEvent?.timeZone ?? "Pacific/Auckland";
  const todayDateOnly = todayDateOnlyInTimeZone(timeZone);
  const greetingLine = dashboardHuiGreetingLine(
    nextEvent?.startsAt,
    timeZone,
    todayDateOnly,
  );

  return <GreetingText name={displayName} greetingLine={greetingLine} />;
}

function GreetingText({
  name,
  greetingLine = "Ready to plan your next hui?",
}: {
  name?: string;
  greetingLine?: string;
}) {
  return (
    <header className="hui-rise pb-6 pt-2">
      <h1 className="hui-type-hero text-foreground">
        Kia ora{name ? `, ${name}` : ""}
      </h1>
      <p className="mt-1.5 text-lg font-bold hui-type-clay">{greetingLine}</p>
    </header>
  );
}

async function PersonalSetupGate() {
  const user = await getServerAuthUser();
  if (!user) {
    return null;
  }
  const supabase = await getServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("personal_setup_completed_at, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.personal_setup_completed_at) {
    return null;
  }
  if (profile?.display_name?.trim()) {
    return null;
  }
  return <PersonalSetupPrompt />;
}

export default function DashboardPage() {
  const vapidPublicKey = getVapidPublicKey();
  const pushConfigured = vapidPublicKey !== null;

  return (
    <AppShell title="Home" hideTitle>
      <Suspense fallback={<GreetingText />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={null}>
        <NoGroupsStartGate />
      </Suspense>
      <Suspense fallback={null}>
        <PersonalSetupGate />
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
