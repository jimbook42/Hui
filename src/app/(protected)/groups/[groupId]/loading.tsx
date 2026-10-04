export default function GroupDetailLoading() {
  return (
    <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading group">
      <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900/60" />
      <div className="h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900/60" />
    </div>
  );
}
