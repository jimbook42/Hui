import Link from "next/link";

import { AppShell } from "@/components/app/app-shell";
import { ChevronRightIcon } from "@/components/hui/icons";
import { HuiSurface } from "@/components/hui/hui-surface";

type ProfileHubLinkProps = {
  href: string;
  title: string;
  description: string;
};

export function ProfileHubLink({ href, title, description }: ProfileHubLinkProps) {
  return (
    <HuiSurface elevated padding="md" className="block">
      <Link
        href={href}
        className="hui-focus-ring flex min-h-14 items-center justify-between gap-4 rounded-hui-md"
      >
        <span className="min-w-0">
          <span className="block text-base font-extrabold text-foreground">{title}</span>
          <span className="mt-0.5 block text-sm font-semibold text-muted-foreground">{description}</span>
        </span>
        <ChevronRightIcon size={22} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </HuiSurface>
  );
}

type ProfileSectionShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function ProfileSectionShell({ title, description, children }: ProfileSectionShellProps) {
  return (
    <AppShell title={title} subtitle={description} back={{ href: "/profile", label: "Profile" }}>
      {children}
    </AppShell>
  );
}
