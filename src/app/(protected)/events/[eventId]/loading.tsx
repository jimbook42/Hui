import { AppShell } from "@/components/app/app-shell";
import { EventBodySkeleton } from "@/components/events/event-page-sections";

export default function EventDetailLoading() {
  return (
    <AppShell title="Hui" hideTitle back={{ href: "/events", label: "Hui" }}>
      <EventBodySkeleton />
    </AppShell>
  );
}
