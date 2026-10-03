import { test, expect } from "@playwright/test";

test("invalid invite link shows a safe message", async ({ page }) => {
  await page.goto("/join/not-a-valid-invite-token");
  await expect(page.getByRole("heading", { name: "Invite not valid" })).toBeVisible();
  await expect(page.getByText(/no longer valid/)).toBeVisible();
});

test("join invite path is public without sign-in redirect", async ({ page }) => {
  await page.goto("/join/public-route-check-token");
  await expect(page).not.toHaveURL(/\/sign-in/);
});
