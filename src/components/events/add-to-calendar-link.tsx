import { eventCalendarIcsPath } from "@/lib/calendar/paths";

type AddToCalendarLinkProps = {
  eventId: string;
};

export function AddToCalendarLink({ eventId }: AddToCalendarLinkProps) {
  return (
    <a
      href={eventCalendarIcsPath(eventId)}
      className="hui-focus-ring inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-sm font-extrabold text-foreground hui-shadow-sm"
      download
    >
      Add to calendar
    </a>
  );
}
