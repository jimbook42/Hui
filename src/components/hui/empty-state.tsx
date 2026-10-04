import { cn } from "@/lib/ui/cn";
import { HuiGatheringMark } from "@/components/hui/hui-gathering-mark";

type EmptyStateProps = {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
};

/** Calm, welcoming empty surface — a quiet gathering mark rather than a dashed box. */
export function EmptyState({ title, description, className, children }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "hui-shape-organic bg-surface px-6 py-10 text-center hui-shadow-md",
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center hui-shape-blob-a bg-sage-soft">
        <HuiGatheringMark size={38} />
      </div>
      <p className="hui-type-section mt-4 text-foreground">{title}</p>
      {description ? (
        <p className="hui-type-supporting mx-auto mt-2 max-w-sm">{description}</p>
      ) : null}
      {children ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
