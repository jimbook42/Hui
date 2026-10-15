import { test, expect } from "@playwright/test";

import { signInWithEmail } from "./helpers/email-auth";
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

test("privacy policy is public", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page).toHaveURL(/\/privacy/);
  await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
  await expect(page.locator("#delete-your-data")).toBeVisible();
});

test("sign-in shows confirmation after account deletion", async ({ page }) => {
  await page.goto("/sign-in?deleted=1");
  await expect(page.getByText(/Your account was deleted/)).toBeVisible();
});

test("sign-in and sign-up pages render", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Microsoft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Facebook" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in with/i })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Continue with Apple" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign up with email" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in with email" })).toBeVisible();

  await page.goto("/sign-in/email");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

  await page.goto("/sign-up");
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Confirm email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

test("invite next survives sign-in ↔ sign-up and OAuth forms", async ({ page }) => {
  const inviteNext = "/join/e2e-invite-token";
  const encoded = encodeURIComponent(inviteNext);

  await page.goto(`/sign-in?next=${encoded}`);
  await expect(page.getByRole("link", { name: "Sign up with email" })).toHaveAttribute(
    "href",
    `/sign-up?next=${encoded}`,
  );

  await page.goto(`/sign-up?next=${encoded}`);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    `/sign-in?next=${encoded}`,
  );
  await expect(page.getByRole("link", { name: "Sign in with email" })).toHaveAttribute(
    "href",
    `/sign-in/email?next=${encoded}`,
  );

  const googleForm = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Sign in with Google" }) })
    .first();
  await expect(googleForm.locator('input[name="next"]')).toHaveValue(inviteNext);

  await page.goto(`/sign-in/email?next=${encoded}`);
  await expect(page.getByRole("link", { name: "Sign up with email" })).toHaveAttribute(
    "href",
    `/sign-up?next=${encoded}`,
  );
  await expect(page.locator('input[name="next"]')).toHaveValue(inviteNext);
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
    await page.getByLabel("Confirm email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await signInWithEmail(page, email, password);
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
