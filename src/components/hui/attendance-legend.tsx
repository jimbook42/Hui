import { AttendanceDot } from "@/components/hui/attendance-dot";

type AttendanceLegendProps = {
  maybeEnabled: boolean;
  className?: string;
};

export function AttendanceLegend({ maybeEnabled, className }: AttendanceLegendProps) {
  return (
    <ul
      className={
        className ??
        "mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-muted-foreground"
      }
    >
      <li className="flex items-center gap-2">
        <AttendanceDot state="yes" label="Can come" size="xs" hideBadge />
        Can come
      </li>
      {maybeEnabled ? (
        <li className="flex items-center gap-2">
          <AttendanceDot state="maybe" label="Could make it work" size="xs" hideBadge />
          Could make it work
        </li>
      ) : null}
      <li className="flex items-center gap-2">
        <AttendanceDot state="no" label="Can't come" size="xs" hideBadge />
        Can&apos;t come
      </li>
      <li className="flex items-center gap-2">
        <AttendanceDot state="pending" label="No answer yet" size="xs" hideBadge />
        No answer yet
      </li>
    </ul>
  );
}
