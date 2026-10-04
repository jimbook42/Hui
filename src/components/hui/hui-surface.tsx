import { cn } from "@/lib/ui/cn";

type HuiSurfaceProps = {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  padding?: "none" | "sm" | "md";
};

const paddingClass = {
  none: "",
  sm: "p-3",
  md: "p-4",
};

export function HuiSurface({
  children,
  className,
  elevated = false,
  padding = "md",
}: HuiSurfaceProps) {
  return (
    <div
      className={cn(
        "rounded-hui-lg border border-border",
        elevated ? "bg-surface-elevated shadow-[var(--shadow-sm)]" : "bg-surface",
        paddingClass[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
