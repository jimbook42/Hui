import type { ReactNode } from "react";

import { ChevronDownIcon } from "@/components/hui/icons";
import { cn } from "@/lib/ui/cn";

type DisclosureCardProps = {
  id?: string;
  title: string;
  /** One-line, always-visible state ("2 times · 1 meets the rules"). */
  summary?: string | null;
  icon?: ReactNode;
  /** Small marker for "this needs you" on a collapsed row. */
  attention?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Progressive disclosure for lower-priority detail. Native <details>, so it works without
 * JavaScript and keeps keyboard + screen-reader semantics for free. Legacy section
 * components are flattened inside (`.hui-embedded`) so they do not double up headings.
 */
export function DisclosureCard({
  id,
  title,
  summary,
  icon,
  attention,
  defaultOpen,
  className,
  children,
}: DisclosureCardProps) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn("hui-details scroll-mt-24 rounded-hui-xl bg-surface hui-shadow-sm", className)}
    >
      <summary className="hui-focus-ring flex min-h-16 items-center gap-3 rounded-hui-xl px-5 py-3.5">
        {icon ? (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-[1.0625rem] font-extrabold leading-tight text-foreground">
            {title}
          </span>
          {summary ? (
            <span className="mt-0.5 block truncate text-sm font-semibold text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </span>
        {attention ? (
          <span
            className="shrink-0 rounded-full bg-clay-soft px-2.5 py-1 text-xs font-extrabold text-foreground"
          >
            Needs you
          </span>
        ) : null}
        <span className="hui-details-chevron shrink-0 text-muted-foreground" aria-hidden="true">
          <ChevronDownIcon size={20} />
        </span>
      </summary>
      <div className="hui-embedded px-5 pb-6 pt-1">{children}</div>
    </details>
  );
}
