import { notFound } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { EventManageSections } from "@/components/events/event-manage-sections";
import { canAccessEventManagement } from "@/domain/events/permissions";
import { pickAcceptedHost } from "@/domain/hosts/display";
import { getServerAuthUser, getServerSupabase } from "@/lib/auth/server-session";
import { getEventDetail } from "@/lib/events/queries";
import { getEventHostContext } from "@/lib/hosts/queries";
import { eventDetailPath } from "@/lib/events/paths";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EventManagePage({ params }: PageProps) {
  const { eventId } = await params;
  const user = await getServerAuthUser();
  const supabase = await getServerSupabase();

  const detail = await getEventDetail(supabase, eventId, user!.id);
  if (!detail) {
    notFound();
  }

  const hostContext = await getEventHostContext(
    supabase,
    eventId,
    detail.groupId,
    user!.id,
  );
  const acceptedHostUserId = hostContext
    ? (pickAcceptedHost(hostContext.assignments)?.userId ?? null)
    : null;

  if (
    !canAccessEventManagement(
      detail.viewerRole,
      user!.id,
      detail.createdBy,
      detail.status,
      acceptedHostUserId,
    )
  ) {
    notFound();
  }

  return (
    <AppShell
      title="Manage this hui"
      hideTitle
      back={{ href: eventDetailPath(eventId), label: detail.title }}
    >
      <div className="space-y-2">
        <h1 className="hui-type-page text-foreground">Manage this hui</h1>
        <p className="hui-type-supporting text-muted-foreground">
          Update planning, hosting, and place. Participants still use the main hui page.
        </p>
      </div>
      <div className="mt-5">
        <EventManageSections detail={detail} userId={user!.id} />
      </div>
    </AppShell>
  );
}
