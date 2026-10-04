import Link from "next/link";
import type { ReactNode } from "react";

import { HuiBotanical } from "@/components/hui/botanical";
import { HuiSurface } from "@/components/hui/hui-surface";
import { HuiLogo } from "@/components/hui/hui-logo";
import { HuiWordmark } from "@/components/hui/hui-wordmark";

type AuthShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="hui-canvas relative flex min-h-full flex-1 flex-col items-center justify-center px-5 py-12">
      <HuiBotanical />
      <main className="relative z-10 w-full max-w-md">
        <Link
          href="/"
          aria-label="Hui home"
          className="hui-focus-ring mx-auto mb-7 flex w-fit flex-col items-center gap-2 rounded-hui-lg p-1"
        >
          <HuiLogo size={64} priority />
          <HuiWordmark height={36} priority />
        </Link>
        <h1 className="hui-type-display hui-rise text-center text-foreground">{title}</h1>
        {description ? (
          <p className="hui-type-supporting mt-2 text-center">{description}</p>
        ) : null}
        <HuiSurface shape="organic" padding="lg" elevated className="hui-rise-2 mt-7">
          {children}
        </HuiSurface>
        {footer ? (
          <div className="mt-6 text-center text-sm font-semibold text-muted-foreground [&_a]:hui-link">
            {footer}
          </div>
        ) : null}
        <p className="mt-4 text-center text-sm">
          <Link
            href="/"
            className="hui-focus-ring inline-flex min-h-11 items-center rounded-full px-4 font-bold text-muted-foreground hover:text-foreground"
          >
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
