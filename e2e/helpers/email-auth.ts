import type { Page } from "@playwright/test";

/** Email/password sign-in via the dedicated route (main /sign-in is OAuth-first). */
export async function signInWithEmail(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/sign-in/email");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
