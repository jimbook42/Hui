"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { fetchEventLifecycleStatusAction } from "@/app/events/actions";
import type { EventStatus } from "@/domain/events/types";
import { createClient } from "@/lib/supabase/client";

const LIVE_STATUSES: EventStatus[] = ["proposing", "awaiting_agreement", "voting"];

export const EVENT_LIFECYCLE_POLL_MS = 10_000;

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
  const statusRef = useRef(status);
  statusRef.current = status;

  const pollLifecycleStatus = useCallback(async () => {
    const result = await fetchEventLifecycleStatusAction(eventId);
    if ("error" in result) {
      return;
    }
    if (result.status === "confirmed" && statusRef.current !== "confirmed") {
      router.refresh();
    }
  }, [eventId, router]);

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

    const intervalId = window.setInterval(() => {
      void pollLifecycleStatus();
    }, EVENT_LIFECYCLE_POLL_MS);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void pollLifecycleStatus();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
      void supabase.removeChannel(channel);
    };
  }, [eventId, status, router, pollLifecycleStatus]);

  return null;
}
