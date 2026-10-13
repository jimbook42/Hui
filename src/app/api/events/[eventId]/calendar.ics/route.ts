import { NextResponse, type NextRequest } from "next/server";

import { getConfiguredAppOrigin, resolveAuthRedirectOriginFromRequest } from "@/lib/auth/app-origin";
import {
  buildEventIcsDocument,
  canDownloadEventIcs,
  eventIcsFilename,
} from "@/lib/calendar/event-ics-export";
import { countEventNewTimeReschedules } from "@/lib/calendar/reschedule-sequence";
import { getEventDetail } from "@/lib/events/queries";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { eventId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const detail = await getEventDetail(supabase, eventId, user.id);
  if (!detail) {
    return new Response("Not found", { status: 404 });
  }

  if (!canDownloadEventIcs(detail.status, detail.startsAt)) {
    return new Response("Not found", { status: 404 });
  }

  const rescheduleCount = await countEventNewTimeReschedules(supabase, eventId);
  const appOrigin = getConfiguredAppOrigin() ?? resolveAuthRedirectOriginFromRequest(request);

  const body = buildEventIcsDocument({
    detail,
    appOrigin,
    rescheduleCount,
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${eventIcsFilename(eventId)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
