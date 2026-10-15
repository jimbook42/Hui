import { test, expect } from "@playwright/test";

import { signInWithEmail } from "./helpers/email-auth";
import {
  createGroup,
  proposeFirstRecurringHui,
  proposeSecondRecurringHui,
} from "./helpers/propose-event";
import { hasPublicSupabaseConfig } from "../src/lib/supabase/env";

const hasLiveAuth =
  hasPublicSupabaseConfig() &&
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD?.trim());

test("unauthenticated group settings URL redirects to sign-in", async ({ page }) => {
  await page.goto("/groups/00000000-0000-4000-8000-000000000001/settings");
  await expect(page).toHaveURL(/\/sign-in/);
});

test.describe("live group smoke", () => {
  test.skip(!hasLiveAuth, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for group smoke E2E");

  test("second recurring propose shows planning date and submits", async ({ page }) => {
    test.setTimeout(120_000);
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const groupName = `E2E second propose ${Date.now()}`;

    await signInWithEmail(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/);

    const groupId = await createGroup(page, groupName);
    await proposeFirstRecurringHui(page, groupId, `First ${Date.now()}`, "2032-03-10");
    await proposeSecondRecurringHui(page, groupId, `Second ${Date.now()}`, "2032-04-10");
  });

  test("legacy /groups/:id/settings redirects to group settings anchor", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const groupName = `E2E settings redirect ${Date.now()}`;

    await signInWithEmail(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/);

    const groupId = await createGroup(page, groupName);
    await page.goto(`/groups/${groupId}/settings`);
    await expect(page).toHaveURL(new RegExp(`/groups/${groupId}#group-settings`));
    const groupSettings = page.locator("#group-settings");
    await expect(groupSettings).toBeVisible({ timeout: 15_000 });
    await expect(groupSettings).toHaveJSProperty("open", true);
    await expect(groupSettings.getByText("Group settings", { exact: true })).toBeVisible();
  });

  test("proposing a past date shows a confirmation dialog", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const groupName = `E2E past propose ${Date.now()}`;

    await signInWithEmail(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/);

    const groupId = await createGroup(page, groupName);
    await page.goto(`/groups/${groupId}/events/new`);

    await page.getByLabel("Type of hui").selectOption({ label: "Meeting" });
    const justOnce = page.getByRole("radio", { name: "Just this once" });
    if (await justOnce.isVisible()) {
      if (!(await justOnce.isChecked())) {
        await page.locator("label").filter({ hasText: /^Just this once$/ }).click();
      }
    }
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "When could it happen?" })).toBeVisible();

    await page.getByLabel("Date").fill("2020-01-15");
    await page.getByLabel("Starts").fill("18:00");
    await expect(page.getByText(/proposed time is in the past/i)).toBeVisible();

    let pastConfirmMessage = "";
    page.once("dialog", (dialog) => {
      pastConfirmMessage = dialog.message();
      void dialog.dismiss();
    });
    await page.getByRole("button", { name: "Continue" }).click({ force: true });
    await expect.poll(() => pastConfirmMessage).toMatch(/in the past/i);
    await expect(page.getByRole("heading", { name: "When could it happen?" })).toBeVisible();
  });
});
