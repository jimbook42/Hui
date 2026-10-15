import type { Page } from "@playwright/test";

/** Create a one-off hui with multiple proposed times (planning wizard). */
export async function proposeOneOffHuiWithTimes(
  page: Page,
  groupId: string,
  title: string,
  dates: string[],
): Promise<string> {
  await page.goto(`/groups/${groupId}/events/new`);
  await page.locator("select").first().selectOption({ label: "Meeting" });
  await page.getByLabel("Name this gathering (optional)").fill(title);
  await page.locator("label").filter({ hasText: "Just this once" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "When could it happen?" }).waitFor();

  for (const date of dates) {
    await page.locator('input[type="date"]').fill(date);
    await page.getByRole("button", { name: "Add time" }).click();
  }

  await page.locator("label").filter({ hasText: /^Skip$/ }).click().catch(() => undefined);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Propose this hui" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}/);

  const match = page.url().match(/events\/([0-9a-f-]{36})/);
  if (!match) {
    throw new Error("Could not read event id after propose");
  }
  return match[1];
}

/** Raise minimum attendees so a solo member can answer every time without auto-confirm. */
export async function setGroupMinimumAttendees(
  page: Page,
  groupId: string,
  minimum: number,
): Promise<void> {
  await page.goto(`/groups/${groupId}#group-settings`);
  await page.getByLabel("Minimum people needed to confirm").fill(String(minimum));
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByText("Settings saved.").waitFor({ timeout: 15_000 });
}
