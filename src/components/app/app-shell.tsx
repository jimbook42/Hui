import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { MobileNav } from "@/components/hui/mobile-nav";
import { NotificationsNavLink } from "@/components/notifications/notifications-nav-link";

type AppShellProps = {
  title: string;
  children: ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  return (
    <div className="hui-page-canvas flex min-h-full flex-1 flex-col">
      <header className="border-b border-border/80 bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="hui-focus-ring shrink-0">
              <Image
                src="/brand/hui-wordmark.png"
                alt="Hui"
                width={72}
                height={28}
                className="h-7 w-auto"
                priority
              />
            </Link>
            <h1 className="hui-type-page-title truncate border-l border-border pl-3 text-foreground">
              {title}
            </h1>
          </div>
          <nav
            className="hidden items-center gap-3 text-sm md:flex"
            aria-label="Account"
          >
            <Link
              href="/dashboard"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Dashboard
            </Link>
            <Link
              href="/groups"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Groups
            </Link>
            <Suspense
              fallback={
                <Link
                  href="/notifications"
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Notifications
                </Link>
              }
            >
              <NotificationsNavLink />
            </Suspense>
            <Link
              href="/profile"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Profile
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="hui-focus-ring text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-10">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
