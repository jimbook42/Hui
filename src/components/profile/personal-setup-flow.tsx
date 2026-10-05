"use client";

import { useState } from "react";

import {
  completePersonalSetupAction,
  skipPersonalSetupAction,
} from "@/app/profile/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { HuiLinkButton } from "@/components/hui/hui-button";
import { HomeLocationSection } from "@/components/profile/home-location-section";
import type { ProfileHomeLocation } from "@/domain/profile/home-location";
import { PendingButton } from "@/components/ui/pending-button";
import { normalizeDisplayName } from "@/lib/profiles/validation";

type Step = "welcome" | "home" | "finish";

type PersonalSetupFlowProps = {
  defaultDisplayName: string;
  home: ProfileHomeLocation | null;
};

export function PersonalSetupFlow({ defaultDisplayName, home }: PersonalSetupFlowProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [nameError, setNameError] = useState<string | null>(null);

  function goToHome() {
    const normalized = normalizeDisplayName(displayName);
    if (!normalized) {
      setNameError("Display name must be between 1 and 80 characters.");
      return;
    }
    setNameError(null);
    setDisplayName(normalized);
    setStep("home");
  }

  return (
    <div className="space-y-6">
      {step === "welcome" ? (
        <section className="space-y-4">
          <h2 className="hui-type-page-title text-foreground">A few things about you</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            These follow you between groups. Skip anything you want to set up later in Profile.
          </p>
          <label className="hui-label">
            <span>Display name</span>
            <input
              className="hui-input"
              name="display_name_draft"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Shown to people who share a group with you.
          </p>
          {nameError ? (
            <p className="hui-message-error" role="alert">{nameError}</p>
          ) : null}
          <PendingButton type="button" size="touch" onClick={goToHome}>
            Next
          </PendingButton>
          <form action={skipPersonalSetupAction}>
            <button type="submit" className="hui-link text-sm font-bold">
              Skip for now
            </button>
          </form>
        </section>
      ) : null}

      {step === "home" ? (
        <section className="space-y-4">
          <h2 className="hui-type-page-title text-foreground">Where is home?</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            Save your home so hosting can be as simple as choosing “At my home”.
          </p>
          <HomeLocationSection home={home} />
          <div className="flex flex-wrap gap-3">
            <PendingButton type="button" size="touch" onClick={() => setStep("finish")}>
              Continue
            </PendingButton>
            <PendingButton type="button" variant="secondary" onClick={() => setStep("finish")}>
              Skip home
            </PendingButton>
          </div>
        </section>
      ) : null}

      {step === "finish" ? (
        <section className="space-y-4">
          <h2 className="hui-type-page-title text-foreground">You&apos;re set</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            Dietary sharing and notifications live in Profile whenever you&apos;re ready.
          </p>
          <AuthForm action={completePersonalSetupAction} submitLabel="Go to Home">
            <input type="hidden" name="display_name" value={displayName} />
          </AuthForm>
          <HuiLinkButton href="/profile/dietary" variant="secondary">
            Set up dietary & food first
          </HuiLinkButton>
          <form action={skipPersonalSetupAction}>
            <button type="submit" className="hui-link text-sm font-bold">
              Skip and go to Home
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
