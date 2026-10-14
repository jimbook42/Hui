"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import { HuiButton } from "@/components/hui/hui-button";
import { CalendarIcon } from "@/components/hui/icons";
import {
  CALENDAR_DOWNLOAD_SUCCESS_MESSAGE,
  downloadEventCalendarIcs,
} from "@/lib/calendar/download-event-calendar-ics";
import { cn } from "@/lib/ui/cn";

const FEEDBACK_MS = 4000;

type AddToCalendarButtonProps = {
  eventId: string;
  variant: "page" | "icon";
  className?: string;
};

export function AddToCalendarButton({ eventId, variant, className }: AddToCalendarButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current !== null) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  const showFeedback = useCallback(
    (message: string) => {
      clearDismissTimer();
      setFeedback(message);
      dismissTimer.current = setTimeout(() => {
        setFeedback(null);
        dismissTimer.current = null;
      }, FEEDBACK_MS);
    },
    [clearDismissTimer],
  );

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  async function handleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (pending) {
      return;
    }
    setPending(true);
    const result = await downloadEventCalendarIcs(eventId);
    setPending(false);
    if (result.ok) {
      showFeedback(CALENDAR_DOWNLOAD_SUCCESS_MESSAGE);
    } else {
      showFeedback(result.error);
    }
  }

  const iconButton = (
    <HuiButton
      type="button"
      variant="secondary"
      size="sm"
      shape="pill"
      className={cn("relative z-10 !min-h-9 !px-2.5", className)}
      aria-label="Add to calendar"
      disabled={pending}
      onClick={(e) => void handleClick(e)}
    >
      <CalendarIcon size={18} aria-hidden />
    </HuiButton>
  );

  if (variant === "icon") {
    return (
      <>
        {iconButton}
        {feedback ? (
          <p
            className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-hui-lg bg-foreground px-4 py-3 text-center text-sm font-semibold text-background hui-shadow-lg"
            role="status"
          >
            {feedback}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <HuiButton
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={(e) => void handleClick(e)}
      >
        <CalendarIcon size={18} className="shrink-0" aria-hidden />
        Add to calendar
      </HuiButton>
      {feedback ? (
        <p className="hui-message-note" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
