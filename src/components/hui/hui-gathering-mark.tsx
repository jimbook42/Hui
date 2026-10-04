import { cn } from "@/lib/ui/cn";

const CENTER = 24;
const RADIUS = 16.5;
const MEMBER_ANGLES = [-90, 30, 150];
const MEMBER_COLORS = [
  "var(--gathering-member-a)",
  "var(--gathering-member-c)",
  "var(--gathering-member-b)",
];

function point(angleDeg: number, r = RADIUS) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

const ARCS = MEMBER_ANGLES.map((angle) => {
  const start = point(angle + 24);
  const end = point(angle + 120 - 24);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
});

/**
 * Brand gathering mark: a ring broken into three arcs with a member in each gap
 * (from the Hui logo). Used as the hub of the gathering visual and in empty states.
 */
export function HuiGatheringMark({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {ARCS.map((d) => (
        <path
          key={d}
          d={d}
          stroke="var(--gathering-ring)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      ))}
      {MEMBER_ANGLES.map((angle, index) => {
        const p = point(angle);
        return <circle key={angle} cx={p.x} cy={p.y} r="4.4" fill={MEMBER_COLORS[index]} />;
      })}
    </svg>
  );
}
