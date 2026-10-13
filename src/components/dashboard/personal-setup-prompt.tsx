import Link from "next/link";

import { HuiSurface } from "@/components/hui/hui-surface";

export function PersonalSetupPrompt() {
  return (
    <HuiSurface tone="sage" padding="md" shape="organic" className="hui-rise mb-6">
      <p className="text-sm font-extrabold text-foreground">Set up your defaults</p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        Add your display name, optional home address, and dietary sharing when it suits you.
      </p>
      <Link href="/profile/setup" className="hui-btn hui-btn-secondary mt-4 inline-flex rounded-full">
        Personal setup
      </Link>
    </HuiSurface>
  );
}
