"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import {
  BellIcon,
  CalendarIcon,
  HomeIcon,
  PeopleIcon,
  UserIcon,
} from "@/components/hui/icons";
import { cn } from "@/lib/ui/cn";

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  match: (path: string) => boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    Icon: HomeIcon,
    match: (path) => path === "/dashboard" || path === "/",
  },
  {
    href: "/events",
    label: "Hui",
    Icon: CalendarIcon,
    match: (path) => path.startsWith("/events"),
  },
  {
    href: "/groups",
    label: "Groups",
    Icon: PeopleIcon,
    match: (path) => path.startsWith("/groups"),
  },
  {
    href: "/notifications",
    label: "Alerts",
    Icon: BellIcon,
    match: (path) => path.startsWith("/notifications"),
  },
  {
    href: "/profile",
    label: "You",
    Icon: UserIcon,
    match: (path) => path.startsWith("/profile"),
  },
];

type BottomNavigationProps = {
  unreadCount?: number;
};

/**
 * Floating five-tab bar for phones (reference: Home / Hui / Groups / … / Profile).
 * Desktop uses the header links in `AppShell`.
 */
export function BottomNavigation({ unreadCount = 0 }: BottomNavigationProps) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      aria-label="Primary"
    >
      <ul className="pointer-events-auto mx-auto flex max-w-md items-stretch justify-between rounded-[2rem] bg-surface p-1.5 hui-shadow-lg">
        {NAV_ITEMS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          const showBadge = label === "Alerts" && unreadCount > 0;
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                aria-label={showBadge ? `${label}, ${unreadCount} unread` : label}
                className={cn(
                  "hui-focus-ring relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-[1.5rem] px-1 py-1.5 text-[0.6875rem] font-extrabold leading-none transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon size={22} />
                  {showBadge ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-1.5 inline-flex min-w-[1.0625rem] items-center justify-center rounded-full bg-[var(--accent-clay)] px-1 text-[0.625rem] font-black leading-[1.0625rem] text-[#1a4331] ring-2 ring-[var(--bg-surface)]"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
