import { expect, type Page } from "@playwright/test";

const GROUP_ID_IN_URL =
  /\/groups\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Parse group id from a /groups/:id/... URL (e.g. after create redirects to /welcome). */
export function parseGroupIdFromUrl(url: string): string {
  const match = url.match(GROUP_ID_IN_URL);
  if (!match) {
    throw new Error(`Could not parse group id from URL: ${url}`);
  }
  return match[1];
}

/** Create a group and return its id (lands on the post-create welcome screen). */
export async function createGroup(page: Page, groupName: string): Promise<string> {
  await page.goto("/groups/new");
  await page.getByLabel("Group name").fill(groupName);
  await page.getByRole("button", { name: "Create group" }).click();
  await page.waitForURL(GROUP_ID_IN_URL);
  return parseGroupIdFromUrl(page.url());
}

/** First recurring hui on a new group (monthly cadence). */
export async function proposeFirstRecurringHui(
  page: Page,
  groupId: string,
  title: string,
  date: string,
): Promise<string> {
  await page.goto(`/groups/${groupId}/events/new`);
  await page.getByLabel("Type of hui").selectOption({ label: "Meeting" });
  await page.getByLabel("Name this hui (optional)").fill(title);
  await page.locator("label").filter({ hasText: /^Monthly$/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "When could it happen?" }).waitFor();
  await page.getByLabel("Date").fill(date);
  await page.getByRole("button", { name: "Add time" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Ready to propose?" }).waitFor();
  await page.getByRole("button", { name: "Propose this hui" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}/);
  const match = page.url().match(/events\/([0-9a-f-]{36})/);
  if (!match) {
    throw new Error("Could not read event id after propose");
  }
  return match[1];
}

/** Second+ recurring hui (established group cadence). */
export async function proposeSecondRecurringHui(
  page: Page,
  groupId: string,
  title: string,
  date: string,
): Promise<string> {
  await page.goto(`/groups/${groupId}/events/new`);
  await page.getByLabel("Type of hui").selectOption({ label: "Meeting" });
  await page.getByLabel("Name this hui (optional)").fill(title);
  const recurring = page.getByRole("radio", { name: /Recurring/i });
  if (await recurring.isVisible()) {
    await page.locator("label").filter({ hasText: /^Recurring/ }).click();
  }
  await expectPlanningDateField(page, date);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "When could it happen?" }).waitFor();
  await page.getByLabel("Date").fill(date);
  await page.getByRole("button", { name: "Add time" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Ready to propose?" }).waitFor();
  await page.getByRole("button", { name: "Propose this hui" }).click();
  await page.waitForURL(/\/events\/[0-9a-f-]{36}/, { timeout: 90_000 });
  const match = page.url().match(/events\/([0-9a-f-]{36})/);
  if (!match) {
    throw new Error("Could not read event id after second propose");
  }
  return match[1];
}

async function expectPlanningDateField(page: Page, fallbackDate: string): Promise<void> {
  const planningDate = page.getByLabel("Planning date for this cycle");
  await expect(planningDate).toBeVisible();
  const value = await planningDate.inputValue();
  if (!value.trim()) {
    await planningDate.fill(fallbackDate);
  }
}

/** Create a one-off hui with multiple proposed times (planning wizard). */
export async function proposeOneOffHuiWithTimes(
  page: Page,
  groupId: string,
  title: string,
  dates: string[],
): Promise<string> {
  await page.goto(`/groups/${groupId}/events/new`);
  await page.getByLabel("Type of hui").selectOption({ label: "Meeting" });
  await page.getByLabel("Name this hui (optional)").fill(title);
  const justOnce = page.getByRole("radio", { name: "Just this once" });
  if (await justOnce.isVisible()) {
    if (!(await justOnce.isChecked())) {
      await page.locator("label").filter({ hasText: /^Just this once$/ }).click();
    }
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "When could it happen?" }).waitFor();

  for (const date of dates) {
    await page.getByLabel("Date").fill(date);
    await page.getByRole("button", { name: "Add time" }).click();
  }

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: "Ready to propose?" }).waitFor();
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
  await page.goto(`/groups/${groupId}/settings`);
  await page.waitForURL(new RegExp(`/groups/${groupId}#group-settings`));

  const groupSettings = page.locator("#group-settings");
  await groupSettings.waitFor({ state: "attached", timeout: 15_000 });
  await expect
    .poll(async () => groupSettings.evaluate((el) => (el as HTMLDetailsElement).open), {
      timeout: 15_000,
    })
    .toBe(true);

  const advanced = groupSettings.locator("details.hui-details");
  if (!(await advanced.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await advanced.locator("summary").click();
  }

  await page.locator('input[name="minimum_attendees"]').fill(String(minimum));
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByText("Settings saved.").waitFor({ timeout: 15_000 });
}
