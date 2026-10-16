import { test, expect } from "@playwright/test";

test("home page shows Hui", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Hui" })).toBeVisible();
  await expect(
    page.getByText("Regular catch-ups, without the group chat chaos."),
  ).toBeVisible();
});
