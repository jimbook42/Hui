"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/ui/cn";

type NavItem = {
  href: string;
  label: string;
  match: (path: string) => boolean;
};

const items: NavItem[] = [
  {
    href: "/dashboard",
    label: "Home",
    match: (path) => path === "/dashboard" || path === "/",
  },
  {
    href: "/groups",
    label: "Groups",
    match: (path) => path.startsWith("/groups"),
  },
  {
    href: "/notifications",
    label: "Alerts",
    match: (path) => path.startsWith("/notifications"),
  },
  {
    href: "/profile",
    label: "You",
    match: (path) => path.startsWith("/profile"),
  },
];

export function MobileNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/98 shadow-[0_-4px_24px_rgb(26_51_40/0.06)] backdrop-blur-md md:hidden hui-safe-bottom"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-2 pt-1 pb-2">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "hui-focus-ring flex flex-col items-center gap-0.5 rounded-hui-md px-2 py-2 text-[11px] font-medium transition",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <NavIcon name={item.label} active={active} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const stroke = active ? "var(--primary)" : "var(--muted-foreground)";
  const common = { width: 22, height: 22, fill: "none", stroke, strokeWidth: 1.75 };

  switch (name) {
    case "Home":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case "Groups":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
          <path d="M14 20c0-2 2.5-3.5 5-3.5" />
        </svg>
      );
    case "Alerts":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <path d="M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21c0-4 3.5-7 7-7s7 3 7 7" />
        </svg>
      );
  }
}
