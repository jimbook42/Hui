import { test, expect, type Locator, type Page } from "@playwright/test";

import { signInWithEmail } from "./helpers/email-auth";
import {
  createGroup,
  proposeOneOffHuiWithTimes,
  setGroupMinimumAttendees,
} from "./helpers/propose-event";
import { hasPublicSupabaseConfig } from "../src/lib/supabase/env";

const hasLiveAuth =
  hasPublicSupabaseConfig() &&
  Boolean(process.env.E2E_TEST_EMAIL?.trim()) &&
  Boolean(process.env.E2E_TEST_PASSWORD?.trim());

function yesButtonIn(scope: Page | ReturnType<Page["locator"]>) {
  return scope.getByRole("button", { name: /^Yes/ });
}

async function yesButtonsPressed(page: Page): Promise<string[]> {
  const rows = page.locator('[data-testid^="respond-time-row-"]');
  const count = await rows.count();
  const pressed: string[] = [];
  for (let index = 0; index < count; index += 1) {
    pressed.push(
      (await yesButtonIn(rows.nth(index)).getAttribute("aria-pressed")) ?? "null",
    );
  }
  return pressed;
}

function timeRow(page: Page, index: number) {
  return page.locator('[data-testid^="respond-time-row-"]').nth(index);
}

async function tapYesAndWaitForSave(yes: Locator): Promise<void> {
  await yes.click();
  await expect.poll(async () => yes.getAttribute("aria-pressed"), { timeout: 30_000 }).toBe("true");
  await expect
    .poll(async () => yes.getAttribute("aria-busy"), { timeout: 30_000 })
    .not.toBe("true");
}

async function tapYesOnEachTimeOneSecondApart(page: Page, mode: "row" | "nth"): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    if (mode === "row") {
      await tapYesAndWaitForSave(yesButtonIn(timeRow(page, index)));
    } else {
      await tapYesAndWaitForSave(yesButtonIn(page).nth(index));
    }
    await page.waitForTimeout(1000);
  }
}

test.describe("multi-time respond reliability (HUI-0186)", () => {
  test.setTimeout(120_000);

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

    const groupId = await createGroup(page, groupName);

    await setGroupMinimumAttendees(page, groupId, 99);

    const eventId = await proposeOneOffHuiWithTimes(page, groupId, title, [
      "2031-06-12",
      "2031-06-14",
      "2031-06-19",
    ]);

    await page.goto(`/events/${eventId}/respond`);
    await expect(page.getByRole("heading", { name: "Can you make it?" })).toBeVisible();
    await expect(yesButtonIn(page)).toHaveCount(3);

    await tapYesOnEachTimeOneSecondApart(page, "row");
    await expect(yesButtonIn(page)).toHaveCount(3);
    await expect.poll(() => yesButtonsPressed(page)).toEqual(["true", "true", "true"]);

    await page.reload();
    await expect(yesButtonIn(page)).toHaveCount(3);
    await expect.poll(() => yesButtonsPressed(page), { timeout: 20_000 }).toEqual([
      "true",
      "true",
      "true",
    ]);

    await page.goto(`/events/${eventId}/respond`);
    await tapYesOnEachTimeOneSecondApart(page, "nth");
    await expect(yesButtonIn(page)).toHaveCount(3);
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
    await expect(page).toHaveURL(/\/dashboard/);

    const groupId = await createGroup(page, groupName);

    await setGroupMinimumAttendees(page, groupId, 99);
    const eventId = await proposeOneOffHuiWithTimes(page, groupId, title, [
      "2031-07-01",
      "2031-07-03",
      "2031-07-08",
    ]);

    await page.goto(`/events/${eventId}/respond`);
    const firstRow = timeRow(page, 0);
    await yesButtonIn(firstRow).waitFor();

    await context.setOffline(true);
    await yesButtonIn(firstRow).click();
    await expect(firstRow.getByRole("alert")).toContainText(/check your connection/i, {
      timeout: 15_000,
    });
    const retry = firstRow.getByRole("button", { name: "Retry" });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(firstRow.getByRole("alert")).toContainText(/check your connection/i);

    await context.setOffline(false);
    await page.waitForLoadState("domcontentloaded");
    const rowAfterReconnect = timeRow(page, 0);
    const retryAfterReconnect = rowAfterReconnect.getByRole("button", { name: "Retry" });
    if (await retryAfterReconnect.isVisible()) {
      await retryAfterReconnect.click();
    } else {
      await tapYesAndWaitForSave(yesButtonIn(rowAfterReconnect));
    }
    await expect
      .poll(async () => yesButtonIn(rowAfterReconnect).getAttribute("aria-pressed"))
      .toBe("true");

    await page.reload();
    await expect
      .poll(async () => yesButtonsPressed(page), { timeout: 20_000 })
      .toContain("true");
  });
});
