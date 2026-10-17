import { test, expect } from "@playwright/test";

import { signInWithEmail } from "./helpers/email-auth";
import { hasPublicSupabaseConfig } from "../src/lib/supabase/env";

const hasLiveAuth =
  hasPublicSupabaseConfig() &&
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD?.trim());

test.describe("what's new banner", () => {
  test.skip(!hasLiveAuth, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for what's new E2E");

  test("shows once after upgrade then dismisses", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("hui_whats_new_last_seen_version", "0.18.16");
    });

    await signInWithEmail(page, process.env.E2E_TEST_EMAIL!, process.env.E2E_TEST_PASSWORD!);
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByRole("region", { name: "What's new" })).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByRole("region", { name: "What's new" })).toBeHidden();

    await page.reload();
    await expect(page.getByRole("region", { name: "What's new" })).toBeHidden();
  });
});
