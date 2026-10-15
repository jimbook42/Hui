import type { Page } from "@playwright/test";

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
  await page.goto(`/groups/${groupId}/settings`);
  await page.waitForURL(new RegExp(`/groups/${groupId}#group-settings`));

  const groupSettings = page.locator("#group-settings");
  await groupSettings.waitFor();
  if (!(await groupSettings.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await groupSettings.locator(":scope > summary").click();
  }

  const advanced = groupSettings.locator("details.hui-details");
  if (!(await advanced.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await advanced.locator("summary").click();
  }

  await page.locator('input[name="minimum_attendees"]').fill(String(minimum));
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByText("Settings saved.").waitFor({ timeout: 15_000 });
}
