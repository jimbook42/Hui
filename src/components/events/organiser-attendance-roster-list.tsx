import {
  groupAttendanceByResponse,
  type AttendanceRoster,
} from "@/domain/scheduling/attendance-roster";

export function OrganiserAttendanceRosterList({ roster }: { roster: AttendanceRoster }) {
  const groups = groupAttendanceByResponse(roster, { showLateTags: true });
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3 text-sm">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="font-semibold text-foreground">{group.label}</p>
          {group.entries ? (
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {group.entries.map((entry) => (
                <li key={entry.displayName} className="flex flex-wrap items-center gap-2">
                  <span className="text-foreground">{entry.displayName}</span>
                  {entry.submittedLate ? (
                    <span
                      className="rounded-full bg-clay-soft px-2 py-0.5 text-xs font-medium text-foreground"
                    >
                      Late
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted-foreground">{group.names.join(", ")}</p>
          )}
        </div>
      ))}
    </div>
  );
}
