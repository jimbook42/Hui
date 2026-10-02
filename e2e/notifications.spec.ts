import { test, expect } from "@playwright/test";

test("unauthenticated notifications access redirects to sign-in", async ({ page }) => {
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("notifications page renders when signed out redirect works", async ({ page }) => {
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
