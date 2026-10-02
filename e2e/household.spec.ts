import { test, expect } from "@playwright/test";

import { hasPublicSupabaseConfig } from "../src/lib/supabase/env";

const hasLiveAuth =
  hasPublicSupabaseConfig() &&
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD?.trim());

test.describe("live household management", () => {
  test.skip(!hasLiveAuth, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for household E2E");

  test("create household from profile and persist after reload", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const householdName = `E2E household ${Date.now()}`;

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/groups/new");
    await page.getByLabel("Group name").fill(`E2E household group ${Date.now()}`);
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page).toHaveURL(/\/groups\//);

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Household" })).toBeVisible();

    const createForm = page
      .locator("section")
      .filter({ hasText: "Household" })
      .getByRole("button", { name: "Create household" })
      .first();
    await page.getByLabel("Household name").first().fill(householdName);
    await createForm.click();

    await expect(page.getByText("Household created.")).toBeVisible();
    await expect(page.getByLabel("Household name").first()).toHaveValue(householdName);

    await page.reload();
    await expect(page.getByLabel("Household name").first()).toHaveValue(householdName);

    const updatedName = `${householdName} updated`;
    await page.getByLabel("Household name").first().fill(updatedName);
    await page.getByRole("button", { name: "Save household name" }).first().click();
    await expect(page.getByText("Household name updated.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Household name").first()).toHaveValue(updatedName);
  });
});
