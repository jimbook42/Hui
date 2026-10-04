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
        "rounded-hui-xl border border-border/90",
        elevated ? "bg-surface-elevated hui-shadow-md" : "bg-surface",
        paddingClass[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
