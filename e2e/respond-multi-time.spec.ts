import { test, expect, type Page } from "@playwright/test";

import { signInWithEmail } from "./helpers/email-auth";
import { proposeOneOffHuiWithTimes, setGroupMinimumAttendees } from "./helpers/propose-event";
import { hasPublicSupabaseConfig } from "../src/lib/supabase/env";

const hasLiveAuth =
  hasPublicSupabaseConfig() &&
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD?.trim());

async function yesButtonsPressed(page: Page): Promise<string[]> {
  return page
    .locator("button")
    .filter({ hasText: /^\s*Yes\s*$/ })
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-pressed") ?? "null"),
    );
}

function timeRow(page: Page, index: number) {
  return page.locator('[data-testid^="respond-time-row-"]').nth(index);
}

async function tapYesOnEachTimeOneSecondApart(page: Page, mode: "row" | "nth"): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    if (mode === "row") {
      await timeRow(page, index).getByRole("button", { name: /^Yes$/ }).click();
    } else {
      await page
        .locator("button")
        .filter({ hasText: /^\s*Yes\s*$/ })
        .nth(index)
        .click();
    }
    await page.waitForTimeout(1000);
  }
}

test.describe("multi-time respond reliability (HUI-0186)", () => {
  test.skip(
    !hasLiveAuth,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD (local Supabase) for respond E2E",
  );

  test("three quick Yes taps keep rows stable and persist after reload", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const groupName = `E2E respond 0186 ${Date.now()}`;
    const title = `E2E three times ${Date.now()}`;

    await signInWithEmail(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/groups/new");
    await page.getByLabel("Group name").fill(groupName);
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page).toHaveURL(/\/groups\//);
    const groupId = page.url().split("/groups/")[1]?.replace(/\/$/, "") ?? "";

    await setGroupMinimumAttendees(page, groupId, 99);

    const eventId = await proposeOneOffHuiWithTimes(page, groupId, title, [
      "2031-06-12",
      "2031-06-14",
      "2031-06-19",
    ]);

    await page.goto(`/events/${eventId}/respond`);
    await expect(page.getByRole("heading", { name: "Can you make it?" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Yes$/ })).toHaveCount(3);

    await tapYesOnEachTimeOneSecondApart(page, "row");
    await expect(page.getByRole("button", { name: /^Yes$/ })).toHaveCount(3);
    await expect.poll(() => yesButtonsPressed(page)).toEqual(["true", "true", "true"]);

    await page.reload();
    await expect(page.getByRole("button", { name: /^Yes$/ })).toHaveCount(3);
    await expect.poll(() => yesButtonsPressed(page), { timeout: 20_000 }).toEqual([
      "true",
      "true",
      "true",
    ]);

    await page.goto(`/events/${eventId}/respond`);
    await tapYesOnEachTimeOneSecondApart(page, "nth");
    await expect(page.getByRole("button", { name: /^Yes$/ })).toHaveCount(3);
    await expect.poll(() => yesButtonsPressed(page)).toEqual(["true", "true", "true"]);
  });

  test("offline save shows Retry until reconnect, then persists after reload", async ({
    page,
    context,
  }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const groupName = `E2E respond offline ${Date.now()}`;
    const title = `E2E offline ${Date.now()}`;

    await signInWithEmail(page, email, password);
    await page.goto("/groups/new");
    await page.getByLabel("Group name").fill(groupName);
    await page.getByRole("button", { name: "Create group" }).click();
    const groupId = page.url().split("/groups/")[1]?.replace(/\/$/, "") ?? "";

    await setGroupMinimumAttendees(page, groupId, 99);
    const eventId = await proposeOneOffHuiWithTimes(page, groupId, title, [
      "2031-07-01",
      "2031-07-03",
      "2031-07-08",
    ]);

    await page.goto(`/events/${eventId}/respond`);
    const firstRow = timeRow(page, 0);
    await firstRow.getByRole("button", { name: /^Yes$/ }).waitFor();

    await context.setOffline(true);
    await firstRow.getByRole("button", { name: /^Yes$/ }).click();
    await expect(page.getByRole("alert")).toContainText(/check your connection/i, {
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();

    await context.setOffline(false);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect
      .poll(async () => firstRow.getByRole("button", { name: /^Yes$/ }).getAttribute("aria-pressed"))
      .toBe("true");

    await page.reload();
    await expect
      .poll(async () => yesButtonsPressed(page), { timeout: 20_000 })
      .toContain("true");
  });
});
