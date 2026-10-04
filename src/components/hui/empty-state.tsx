import { cn } from "@/lib/ui/cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
};

export function EmptyState({ title, description, className, children }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-hui-lg border border-dashed border-border bg-muted/50 px-4 py-8 text-center",
        className,
      )}
    >
      <p className="hui-type-section text-foreground">{title}</p>
      {description ? (
        <p className="hui-type-supporting mt-2 mx-auto max-w-sm">{description}</p>
      ) : null}
      {children ? <div className="mt-4 flex justify-center gap-2">{children}</div> : null}
    </div>
  );
}
