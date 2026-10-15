"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { EventStatus } from "@/domain/events/types";
import { createClient } from "@/lib/supabase/client";

const LIVE_STATUSES: EventStatus[] = ["proposing", "awaiting_agreement", "voting"];

/**
 * Refetches the event page when the hui confirms so members who already have the page open see
 * the locked time and next steps without a manual reload.
 */
export function EventLifecycleLiveRefresh({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!LIVE_STATUSES.includes(status)) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`event-status-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          const nextStatus = (payload.new as { status?: EventStatus }).status;
          if (nextStatus === "confirmed") {
            router.refresh();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, status, router]);

  return null;
}
