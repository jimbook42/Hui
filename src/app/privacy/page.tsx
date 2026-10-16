import Link from "next/link";

import { HuiBotanical } from "@/components/hui/botanical";
import { HuiSurface } from "@/components/hui/hui-surface";
import { HuiLogo } from "@/components/hui/hui-logo";
import { HuiWordmark } from "@/components/hui/hui-wordmark";
import { PrivacyStatementContent } from "@/lib/legal/privacy-statement-content";
import {
  PRIVACY_LAST_UPDATED,
  PRIVACY_STATEMENT_TITLE,
} from "@/lib/legal/privacy-statement-constants";

export default function PrivacyPage() {
  return (
    <div className="hui-canvas relative flex min-h-full flex-1 flex-col px-5 py-10">
      <HuiBotanical />
      <main className="relative z-10 mx-auto w-full max-w-2xl">
        <Link
          href="/"
          aria-label="Hui home"
          className="hui-focus-ring mx-auto mb-8 flex w-fit flex-col items-center gap-2 rounded-hui-lg p-1"
        >
          <HuiLogo size={48} />
          <HuiWordmark height={28} />
        </Link>

        <h1 className="hui-type-display text-center text-foreground">{PRIVACY_STATEMENT_TITLE}</h1>
        <p className="hui-type-supporting mt-2 text-center">
          Last updated: {PRIVACY_LAST_UPDATED}
        </p>

        <HuiSurface shape="organic" padding="lg" elevated className="hui-rise mt-8">
          <PrivacyStatementContent />
        </HuiSurface>

        <p className="mt-6 text-center text-sm">
          <Link
            href="/sign-in"
            className="hui-focus-ring inline-flex min-h-11 items-center rounded-full px-4 font-bold text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
