import { cn } from "@/lib/ui/cn";

type SectionHeaderProps = {
  title: string;
  description?: string;
  className?: string;
};

export function SectionHeader({ title, description, className }: SectionHeaderProps) {
  return (
    <header className={cn("space-y-1", className)}>
      <h2 className="hui-type-section text-foreground">{title}</h2>
      {description ? <p className="hui-type-supporting">{description}</p> : null}
    </header>
  );
}
