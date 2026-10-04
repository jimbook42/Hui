"use client";

import { useState } from "react";

import { HuiLogo } from "@/components/hui/hui-logo";
import { HuiSurface } from "@/components/hui/hui-surface";
import { huiButtonClass } from "@/components/hui/hui-button";
import { installInstructionsFor, shouldShowInstallCard } from "@/domain/pwa/install";
import {
  dismissInstallCard,
  promptInstall,
  useInstallSnapshot,
} from "@/lib/pwa/install-store";

function InstructionSteps({ platform }: { platform: Parameters<typeof installInstructionsFor>[0] }) {
  const { steps } = installInstructionsFor(platform);
  if (steps.length === 1) {
    return <p className="hui-type-supporting">{steps[0]}</p>;
  }
  return (
    <ol className="hui-type-supporting list-decimal space-y-1 pl-5">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

/**
 * Profile > Install section. Always available (never dismissed) so people can find it when they
 * want it; it simply says so once Hui is installed.
 */
export function InstallHuiSettings() {
  const state = useInstallSnapshot();
  const [message, setMessage] = useState<string | null>(null);

  if (!state.ready) {
    return <p className="hui-type-supporting">Checking this device&hellip;</p>;
  }

  if (state.availability === "installed") {
    return (
      <p className="hui-type-supporting" role="status">
        Hui is on this device&apos;s home screen. Open it from there for the full-screen app.
      </p>
    );
  }

  const instructions = installInstructionsFor(state.platform);

  return (
    <div className="space-y-4">
      {state.availability === "prompt" ? (
        <>
          <p className="hui-type-supporting">
            Add Hui to this device for quicker access and a full-screen app without the browser bar.
          </p>
          <button
            type="button"
            className={huiButtonClass({ variant: "primary" })}
            onClick={async () => {
              const outcome = await promptInstall();
              setMessage(
                outcome === "dismissed"
                  ? "No problem. You can add Hui any time from here."
                  : outcome === "unavailable"
                    ? "Your browser didn\u2019t offer to install. Try its menu instead."
                    : null,
              );
            }}
          >
            Install Hui
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-foreground">{instructions.title}</p>
          <InstructionSteps platform={state.platform} />
        </>
      )}
      {message ? (
        <p className="hui-type-supporting" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Small dismissible card on the dashboard. Hidden when installed, unsupported, on desktop
 * instructions-only platforms, and for 30 days after "Not now" (or a dismissed browser prompt).
 */
export function InstallHuiCard() {
  const state = useInstallSnapshot();
  const [expanded, setExpanded] = useState(false);

  if (
    !state.ready ||
    !shouldShowInstallCard({
      availability: state.availability,
      platform: state.platform,
      dismissedAt: state.dismissedAt,
      now: state.now,
    })
  ) {
    return null;
  }

  return (
    <HuiSurface tone="sage" shape="organic" padding="md" className="hui-rise mb-6">
      <section aria-label="Add Hui to your home screen" className="flex items-start gap-4">
        <HuiLogo size={48} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold text-foreground">
            {state.availability === "prompt" ? "Install Hui" : "Add Hui to your home screen"}
          </h2>
          <p className="hui-type-supporting mt-1">
            Open Hui in one tap, like any other app.
          </p>
          {expanded && state.availability === "instructions" ? (
            <div className="mt-3">
              <InstructionSteps platform={state.platform} />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {state.availability === "prompt" ? (
              <button
                type="button"
                className={huiButtonClass({ variant: "primary", size: "sm" })}
                onClick={() => void promptInstall()}
              >
                Install Hui
              </button>
            ) : (
              <button
                type="button"
                className={huiButtonClass({ variant: "primary", size: "sm" })}
                aria-expanded={expanded}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? "Hide steps" : "Show me how"}
              </button>
            )}
            <button
              type="button"
              className={huiButtonClass({ variant: "ghost", size: "sm" })}
              onClick={dismissInstallCard}
            >
              Not now
            </button>
          </div>
        </div>
      </section>
    </HuiSurface>
  );
}
