import { test, expect } from "@playwright/test";

import { hasPublicSupabaseConfig } from "../src/lib/supabase/env";

const hasLiveAuth =
  hasPublicSupabaseConfig() &&
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD?.trim());

test.describe("live event hosting", () => {
  test.skip(!hasLiveAuth, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for host E2E");

  test("organiser confirms an event and assigns a host", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const groupName = `E2E host group ${Date.now()}`;
    const eventTitle = `E2E hosted dinner ${Date.now()}`;

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

    await page.goto(`/groups/${groupId}/events/new`);
    await page.getByLabel("Title").fill(eventTitle);
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page).toHaveURL(/\/events\//);

    const starts = page.getByLabel("Starts").last();
    const ends = page.getByLabel("Ends").last();
    await starts.fill("2030-07-15T18:00");
    await ends.fill("2030-07-15T21:00");
    await page.getByRole("button", { name: "Add candidate" }).click();

    await page.getByRole("radio", { name: "Available" }).click();
    await page.getByRole("button", { name: "Save response" }).click();
    await expect(page.getByText("Response saved.")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Confirm this time" }).click();
    await expect(page.getByText("Event confirmed.")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole("heading", { level: 2, name: "Host" })).toBeVisible();
    await page.getByRole("button", { name: /Ask .+ to host/ }).click();
    await expect(page.getByText("Host updated.")).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(/Host:/)).toBeVisible();

    await page.goto(`/groups/${groupId}`);
    await expect(page.getByRole("heading", { level: 2, name: "Hosting history" })).toBeVisible();
  });
});
