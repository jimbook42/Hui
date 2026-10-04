import { AttendanceDot } from "@/components/hui/attendance-dot";

type AttendanceLegendProps = {
  maybeEnabled: boolean;
};

export function AttendanceLegend({ maybeEnabled }: AttendanceLegendProps) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <li className="flex items-center gap-2">
        <AttendanceDot state="yes" label="Can come" size="sm" />
        Can come
      </li>
      {maybeEnabled ? (
        <li className="flex items-center gap-2">
          <AttendanceDot state="maybe" label="Could make it work" size="sm" />
          Could make it work
        </li>
      ) : null}
      <li className="flex items-center gap-2">
        <AttendanceDot state="no" label="Can't come" size="sm" />
        Can&apos;t come
      </li>
      <li className="flex items-center gap-2">
        <AttendanceDot state="pending" label="No answer yet" size="sm" />
        No answer yet
      </li>
    </ul>
  );
}
