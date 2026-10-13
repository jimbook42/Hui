import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

type SectionHeaderProps = {
  title: string;
  description?: string;
  className?: string;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
  id?: string;
};

export function SectionHeader({
  title,
  description,
  className,
  action,
  as: Heading = "h2",
  id,
}: SectionHeaderProps) {
  return (
    <header className={cn("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0 space-y-1">
        <Heading id={id} className="hui-type-section text-foreground">
          {title}
        </Heading>
        {description ? <p className="hui-type-supporting">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
