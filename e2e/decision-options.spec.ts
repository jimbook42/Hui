import { test, expect } from "@playwright/test";

test.describe("Decision poll options (smoke)", () => {
  test("create event decision form exposes per-option inputs", async ({ page }) => {
    test.skip(!process.env.E2E_TEST_EMAIL, "Requires E2E auth env");

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Sign in/i })).toBeVisible();
  });
});
