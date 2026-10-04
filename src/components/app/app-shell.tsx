import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { signOutAction } from "@/app/auth/actions";
import { HuiBotanical } from "@/components/hui/botanical";
import { BottomNavigation } from "@/components/hui/bottom-navigation";
import { HuiWordmark } from "@/components/hui/hui-wordmark";
import { ArrowLeftIcon, BellIcon } from "@/components/hui/icons";
import { getUnreadNotificationCount } from "@/lib/notifications/unread-count";
import { cn } from "@/lib/ui/cn";

const DESKTOP_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/events", label: "Hui" },
  { href: "/groups", label: "Groups" },
  { href: "/profile", label: "Profile" },
];

type AppShellProps = {
  title: string;
  children: ReactNode;
  /** Render a back chip instead of the wordmark in the top bar. */
  back?: { href: string; label: string };
  /** Visually hide the page title (pages that supply their own hero heading). */
  hideTitle?: boolean;
  subtitle?: string;
  /** Keep content narrow (single-column flows). */
  narrow?: boolean;
};

async function BottomNavWithBadge() {
  const unread = await getUnreadNotificationCount();
  return <BottomNavigation unreadCount={unread} />;
}

async function HeaderBell() {
  const unread = await getUnreadNotificationCount();
  return <BellLink unread={unread} />;
}

function BellLink({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className="hui-focus-ring relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-foreground hui-shadow-sm transition-transform active:scale-95"
    >
      <BellIcon size={21} />
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--accent-clay)] px-1 text-[0.625rem] font-black leading-[1.125rem] text-[#1a4331] ring-2 ring-[var(--bg-canvas)]"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

export function AppShell({ title, children, back, hideTitle, subtitle, narrow }: AppShellProps) {
  return (
    <div className="hui-canvas flex min-h-full flex-1 flex-col">
      <HuiBotanical />

      <header className="sticky top-0 z-30 bg-[color-mix(in_srgb,var(--bg-canvas)_82%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
          {back ? (
            <Link
              href={back.href}
              className="hui-focus-ring inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full bg-surface py-1.5 pl-3 pr-4 text-sm font-extrabold text-foreground hui-shadow-sm transition-transform active:scale-95"
            >
              <ArrowLeftIcon size={18} className="shrink-0" />
              <span className="truncate">{back.label}</span>
            </Link>
          ) : (
            <Link href="/dashboard" className="hui-focus-ring -ml-1 flex min-h-11 shrink-0 items-center rounded-hui-lg p-1" aria-label="Hui home">
              <HuiWordmark priority />
            </Link>
          )}

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary desktop">
            {DESKTOP_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hui-focus-ring rounded-full px-4 py-2 text-sm font-extrabold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <form action={signOutAction}>
              <button
                type="submit"
                className="hui-focus-ring rounded-full px-4 py-2 text-sm font-extrabold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </nav>

          <Suspense fallback={<BellLink unread={0} />}>
            <HeaderBell />
          </Suspense>
        </div>
      </header>

      <main
        className={cn(
          "relative z-10 mx-auto w-full flex-1 px-5 pb-32 pt-3 sm:px-6 md:pb-14",
          narrow ? "max-w-xl" : "max-w-3xl",
        )}
      >
        {hideTitle ? null : (
          <div className="hui-rise mb-5 mt-2">
            <h1 className="hui-type-display text-foreground">{title}</h1>
            {subtitle ? <p className="hui-type-supporting mt-1.5 max-w-prose">{subtitle}</p> : null}
          </div>
        )}
        {children}
      </main>

      <Suspense fallback={<BottomNavigation />}>
        <BottomNavWithBadge />
      </Suspense>
    </div>
  );
}
