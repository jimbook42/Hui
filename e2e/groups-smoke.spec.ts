import { test, expect } from "@playwright/test";

import { signInWithEmail } from "./helpers/email-auth";
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

  test("legacy /groups/:id/settings redirects to group settings anchor", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const groupName = `E2E settings redirect ${Date.now()}`;

    await signInWithEmail(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/groups/new");
    await page.getByLabel("Group name").fill(groupName);
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page).toHaveURL(/\/groups\//);

    const groupId = page.url().split("/groups/")[1]?.replace(/\/$/, "") ?? "";
    await page.goto(`/groups/${groupId}/settings`);
    await expect(page).toHaveURL(new RegExp(`/groups/${groupId}#group-settings`));
    await expect(page.getByRole("heading", { name: "Group settings" })).toBeVisible();
  });

  test("proposing a past date shows a confirmation dialog", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const groupName = `E2E past propose ${Date.now()}`;

    await signInWithEmail(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/groups/new");
    await page.getByLabel("Group name").fill(groupName);
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page).toHaveURL(/\/groups\//);

    const groupId = page.url().split("/groups/")[1]?.replace(/\/$/, "") ?? "";
    await page.goto(`/groups/${groupId}/events/new`);

    await page.locator('select').first().selectOption({ index: 1 });
    await page.getByRole("radio", { name: "Just this once" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "When could it happen?" })).toBeVisible();

    await page.getByLabel("Date").fill("2020-01-15");
    await page.getByLabel("Starts").fill("18:00");

    const dialogPromise = page.waitForEvent("dialog");
    await page.getByRole("button", { name: "Continue" }).click();
    const dialog = await dialogPromise;
    expect(dialog.message()).toMatch(/in the past/i);
    await dialog.dismiss();
    await expect(page.getByRole("heading", { name: "When could it happen?" })).toBeVisible();
  });
});
