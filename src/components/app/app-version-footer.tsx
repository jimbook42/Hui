import { appVersionLine } from "@/lib/build/app-version";
import { cn } from "@/lib/ui/cn";

export function AppVersionFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "relative z-10 shrink-0 px-5 pb-[max(5.25rem,calc(env(safe-area-inset-bottom)+4.25rem))] pt-3 text-center md:pb-4",
        className,
      )}
    >
      <p className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground/80">
        {appVersionLine()}
      </p>
    </footer>
  );
}
