import { AppShell } from "@/components/app/app-shell";

export default function ProfileLoading() {
  return (
    <AppShell title="Account settings">
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400" aria-busy="true">
        Loading your settings…
      </p>
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80" />
        <div className="h-32 animate-pulse rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80" />
      </div>
    </AppShell>
  );
}
