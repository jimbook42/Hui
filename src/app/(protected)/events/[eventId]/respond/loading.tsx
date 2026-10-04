export default function EventRespondLoading() {
  return (
    <div
      className="mx-auto mt-8 max-w-md space-y-4 px-4"
      aria-busy="true"
      aria-label="Loading response flow"
    >
      <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-8 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-12 w-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
