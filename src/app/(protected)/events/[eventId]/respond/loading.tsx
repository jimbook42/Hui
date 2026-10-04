import { AppShell } from "@/components/app/app-shell";

export default function EventRespondLoading() {
  return (
    <AppShell title="Your response">
      <div
        className="mx-auto max-w-md space-y-4 pb-8"
        aria-busy="true"
        aria-label="Loading response flow"
      >
        <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-7 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <p className="text-base font-medium text-zinc-900 dark:text-zinc-50">
          Can you make this time?
        </p>
        <div className="space-y-2">
          <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </AppShell>
  );
}
