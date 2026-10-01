import Link from "next/link";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";

type AppShellProps = {
  title: string;
  children: ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Hui</p>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/dashboard"
              className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
            >
              Dashboard
            </Link>
            <Link
              href="/profile"
              className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
            >
              Profile
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-300"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
