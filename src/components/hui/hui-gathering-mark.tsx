import { cn } from "@/lib/ui/cn";

/** Brand gathering mark — three members in a shared ring (from app icon / logo references). */
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
      <circle
        cx="24"
        cy="24"
        r="18"
        stroke="var(--gathering-ring)"
        strokeWidth="4"
      />
      <circle cx="24" cy="11" r="5.5" fill="var(--gathering-member-a)" />
      <circle cx="14.5" cy="30" r="5.5" fill="var(--gathering-member-b)" />
      <circle cx="33.5" cy="30" r="5.5" fill="var(--gathering-member-c)" />
    </svg>
  );
}
