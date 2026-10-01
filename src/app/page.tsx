import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
