export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <main className="w-full max-w-lg text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Hui
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Privacy-first coordination for recurring gatherings. The app proposes,
          coordinates, and remembers—the group decides.
        </p>
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-500">
          Development scaffold — see <code className="font-mono">ROADMAP.md</code>{" "}
          for status.
        </p>
      </main>
    </div>
  );
}
