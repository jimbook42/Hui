import { test, expect } from "@playwright/test";

import { hasPublicSupabaseConfig } from "../src/lib/supabase/env";

const hasLiveAuth =
  hasPublicSupabaseConfig() &&
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD?.trim());

test.describe("live dietary information", () => {
  test.skip(!hasLiveAuth, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for dietary E2E");

  test("add, share, and revoke dietary entry", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const label = `E2E dietary ${Date.now()}`;

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const groupName = `E2E dietary group ${Date.now()}`;
    await page.goto("/groups/new");
    await page.getByLabel("Group name").fill(groupName);
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page).toHaveURL(/\/groups\//);

    await page.goto("/profile");
    const dietarySection = page.locator("section").filter({ hasText: "Dietary information" });
    await expect(dietarySection.getByRole("heading", { name: "Dietary information" })).toBeVisible();

    await dietarySection.getByLabel("Label").fill(label);
    await dietarySection.getByRole("button", { name: "Add entry" }).click();
    await expect(page.getByText("Dietary information added.")).toBeVisible();
    await expect(dietarySection.getByText(label)).toBeVisible();
    await expect(dietarySection.getByText("Private").first()).toBeVisible();

    await page.reload();
    await expect(dietarySection.getByText(label)).toBeVisible();

    const shareButton = dietarySection.getByRole("button", { name: new RegExp(`Share with ${groupName}`) });
    await shareButton.click();
    await expect(page.getByText("Shared with group.")).toBeVisible();
    await expect(dietarySection.getByText(`Shared with ${groupName}`)).toBeVisible();

    await page.goto("/groups");
    await page.getByRole("link", { name: groupName }).click();
    await expect(page.getByRole("heading", { name: "Dietary information" })).toBeVisible();
    await expect(page.getByText(label)).toBeVisible();

    await page.goto("/profile");
    await dietarySection.getByRole("button", { name: "Stop sharing" }).first().click();
    await expect(page.getByText("No longer shared with that group.")).toBeVisible();

    await page.goto("/groups");
    await page.getByRole("link", { name: groupName }).click();
    await expect(page.getByText("No dietary information has been shared with this group.")).toBeVisible();
  });
});
