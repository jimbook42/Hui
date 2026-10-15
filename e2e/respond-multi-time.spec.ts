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

type RowBox = { y: number; height: number };

async function answerRowBoxes(page: Page): Promise<RowBox[]> {
  const rows = page.locator('[data-testid^="respond-time-row-"]');
  const count = await rows.count();
  const boxes: RowBox[] = [];
  for (let index = 0; index < count; index += 1) {
    const box = await rows.nth(index).boundingBox();
    if (!box) {
      throw new Error(`Missing bounding box for respond row ${index}`);
    }
    boxes.push({ y: box.y, height: box.height });
  }
  return boxes;
}

function assertRowLayoutStable(before: RowBox[], after: RowBox[], label: string): void {
  expect(before.length, `${label}: row count`).toBe(after.length);
  for (let index = 0; index < before.length; index += 1) {
    expect(Math.abs(after[index].y - before[index].y), `${label}: row ${index} y`).toBeLessThanOrEqual(
      2,
    );
    expect(
      Math.abs(after[index].height - before[index].height),
      `${label}: row ${index} height`,
    ).toBeLessThanOrEqual(2);
  }
}

async function tapYesAndWaitForSave(page: Page, yes: Locator): Promise<void> {
  await yes.click();
  await expect
    .poll(async () => yesButtonIn(page).count(), { timeout: 5_000 })
    .toBe(3);
  await expect.poll(async () => yes.getAttribute("aria-pressed"), { timeout: 30_000 }).toBe("true");
  await expect
    .poll(async () => yes.getAttribute("aria-busy"), { timeout: 30_000 })
    .not.toBe("true");
}

async function tapYesOnEachTimeOneSecondApart(page: Page, mode: "row" | "nth"): Promise<void> {
  for (let index = 0; index < 3; index += 1) {
    if (mode === "row") {
      await tapYesAndWaitForSave(page, yesButtonIn(timeRow(page, index)));
    } else {
      await tapYesAndWaitForSave(page, yesButtonIn(page).nth(index));
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

  test("answer rows stay within 2px while Saving and after Saved", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    const groupName = `E2E respond layout ${Date.now()}`;
    const title = `E2E row stability ${Date.now()}`;

    await signInWithEmail(page, email, password);
    const groupId = await createGroup(page, groupName);
    await setGroupMinimumAttendees(page, groupId, 99);
    const eventId = await proposeOneOffHuiWithTimes(page, groupId, title, [
      "2031-08-12",
      "2031-08-14",
      "2031-08-19",
    ]);

    await page.goto(`/events/${eventId}/respond`);
    await expect(yesButtonIn(page)).toHaveCount(3);

    const beforeTap = await answerRowBoxes(page);
    const firstYes = yesButtonIn(timeRow(page, 0));
    await firstYes.click();

    await expect(firstYes).toHaveAttribute("aria-busy", "true");
    const duringSaving = await answerRowBoxes(page);
    assertRowLayoutStable(beforeTap, duringSaving, "during Saving");

    await expect
      .poll(async () => firstYes.getAttribute("aria-busy"), { timeout: 30_000 })
      .not.toBe("true");
    await expect(firstYes).toHaveAttribute("aria-pressed", "true");

    const afterSaved = await answerRowBoxes(page);
    assertRowLayoutStable(beforeTap, afterSaved, "after Saved");
  });

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
    await page.waitForTimeout(3000);
    const rowAfterReconnect = timeRow(page, 0);
    const retryAfterReconnect = rowAfterReconnect.getByRole("button", { name: "Retry" });
    await expect(retryAfterReconnect).toBeVisible();
    await retryAfterReconnect.click();
    await expect
      .poll(async () => yesButtonIn(rowAfterReconnect).getAttribute("aria-pressed"))
      .toBe("true");

    await page.reload();
    await expect
      .poll(async () => yesButtonsPressed(page), { timeout: 20_000 })
      .toContain("true");
  });
});
