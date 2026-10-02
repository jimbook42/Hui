import { test, expect } from "@playwright/test";

import { hasPublicSupabaseConfig } from "../src/lib/supabase/env";

const hasLiveAuth =
  hasPublicSupabaseConfig() &&
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD?.trim());

test.describe("live event contributions", () => {
  test.skip(!hasLiveAuth, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for contribution E2E");

  test("member claims and releases a contribution on an event", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const groupName = `E2E contribution group ${Date.now()}`;
    const eventTitle = `E2E potluck ${Date.now()}`;
    const categoryName = `Dessert ${Date.now()}`;

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/groups/new");
    await page.getByLabel("Group name").fill(groupName);
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page).toHaveURL(/\/groups\//);
    const groupUrl = page.url();
    const groupId = groupUrl.split("/groups/")[1]?.replace(/\/$/, "") ?? "";

    await page.getByRole("heading", { level: 2, name: "Contribution categories" }).scrollIntoViewIfNeeded();
    await page.getByLabel("New category").fill(categoryName);
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByText("Category added.")).toBeVisible({ timeout: 15_000 });

    await page.goto(`/groups/${groupId}/events/new`);
    await page.getByLabel("Title").fill(eventTitle);
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page).toHaveURL(/\/events\//);

    await expect(page.getByRole("heading", { level: 2, name: "Contributions" })).toBeVisible();
    await page.getByLabel("What you're bringing (optional)").fill("Chocolate cake");
    await page.getByRole("button", { name: `Claim ${categoryName}` }).click();
    await expect(page.getByText("Contribution claimed.")).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(new RegExp(`${categoryName} —`))).toBeVisible();

    await page.getByRole("button", { name: "Release contribution" }).click();
    await expect(page.getByText("Contribution released.")).toBeVisible({ timeout: 15_000 });
  });
});
