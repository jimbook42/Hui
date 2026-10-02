import { test, expect } from "@playwright/test";

import { hasPublicSupabaseConfig } from "../src/lib/supabase/env";

const hasLiveAuth =
  hasPublicSupabaseConfig() &&
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD?.trim());

test("unauthenticated dashboard access redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("unauthenticated groups access redirects to sign-in", async ({ page }) => {
  await page.goto("/groups");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("unauthenticated profile access redirects to sign-in", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("sign-in shows confirmation after account deletion", async ({ page }) => {
  await page.goto("/sign-in?deleted=1");
  await expect(page.getByText(/Your account was deleted/)).toBeVisible();
});

test("sign-in and sign-up pages render", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Microsoft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Facebook" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with/i })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Continue with Apple" })).toHaveCount(0);
  await page.goto("/sign-up");
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Microsoft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Facebook" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue with/i })).toHaveCount(3);
});

test("OAuth cancellation shows a friendly sign-in notice", async ({ page }) => {
  await page.goto("/sign-in?oauth=cancelled");
  await expect(page.getByText(/Social sign-in was cancelled/)).toBeVisible();
});

test("OAuth provider errors show a friendly sign-in notice", async ({ page }) => {
  await page.goto("/sign-in?oauth=failed");
  await expect(page.getByText(/Social sign-in could not be completed/)).toBeVisible();
});

test.describe("live Supabase auth", () => {
  test.skip(!hasLiveAuth, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for full auth E2E");

  test("sign-up, sign-in, dashboard, profile update, and sign-out", async ({
    page,
  }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const displayName = `E2E ${Date.now()}`;

    await page.goto("/sign-up");
    await page.getByLabel("Display name").fill(displayName);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign up" }).click();

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
    await expect(page.getByText("Account email")).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete my account" })).toBeVisible();

    const profileName = `${displayName} Updated`;
    await page.getByLabel("Display name").fill(profileName);
    await page.getByRole("button", { name: "Save display name" }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible();
    await expect(page.getByLabel("Display name")).toHaveValue(profileName);

    await page.reload();
    await expect(page.getByLabel("Display name")).toHaveValue(profileName);

    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
