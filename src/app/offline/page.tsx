export default function OfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        You are offline
      </h1>
      <p className="mt-4 max-w-md text-zinc-600 dark:text-zinc-400">
        Hui needs a network connection for group and event data. Reconnect to
        continue.
      </p>
    </div>
  );
}
