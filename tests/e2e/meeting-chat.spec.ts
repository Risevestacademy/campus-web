import { expect, type Locator } from "@playwright/test";

import { enterCampus } from "./support/campus-entry";
import { membership, sessions, signIn, test } from "./support/fake-api-fixture";
import { installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const CAMPUS = "/campus/c-3";

async function widthOf(element: Locator): Promise<number> {
  return (await element.boundingBox())?.width ?? 0;
}

test.beforeEach(async ({ baseURL, context, fakeApi, page }) => {
  await installSanityMapStub(page);
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.member(membership("c-3", "Cohort 3")));
  await enterCampus(page, CAMPUS);
});

test("chat opens from the control bar and takes the sidebar's place", async ({
  page,
}) => {
  const sidebar = page.locator('[data-slot="campus-sidebar"]');
  await expect.poll(() => widthOf(sidebar)).toBeGreaterThan(300);

  await page.getByRole("button", { name: "Open chat" }).click();

  const chat = page.getByRole("complementary", { name: "Meeting chat" });
  await expect(chat).toBeVisible();
  await expect(chat.getByRole("tab")).toHaveText([
    /Chat/,
    /People/,
    /Resources/,
  ]);
  await expect.poll(() => widthOf(sidebar)).toBeLessThan(10);
  await expect.poll(() => widthOf(chat)).toBeGreaterThan(300);
  await expect(
    page.getByRole("button", { name: "Close chat", expanded: true }),
  ).toHaveCount(1);
});

test("closing chat brings the sidebar back and hands focus to the control bar", async ({
  page,
}) => {
  const sidebar = page.locator('[data-slot="campus-sidebar"]');
  await page.getByRole("button", { name: "Open chat" }).click();
  const chat = page.getByRole("complementary", { name: "Meeting chat" });
  await expect(chat).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(chat).toBeHidden();
  await expect.poll(() => widthOf(sidebar)).toBeGreaterThan(300);
  await expect(page.getByRole("button", { name: "Open chat" })).toBeFocused();
});

test("showing the sidebar from the rail closes chat", async ({ page }) => {
  await page.getByRole("button", { name: "Open chat" }).click();
  const chat = page.getByRole("complementary", { name: "Meeting chat" });
  await expect(chat).toBeVisible();

  await page
    .getByRole("navigation", { name: "Campus" })
    .getByRole("button", { name: "Tasks" })
    .click();

  await expect(chat).toBeHidden();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
});

test("chat opening does not change what is saved for the sidebar", async ({
  page,
}) => {
  const saved = () =>
    page.evaluate(() => window.localStorage.getItem("campus-sidebar"));
  const before = await saved();

  await page.getByRole("button", { name: "Open chat" }).click();
  await page.keyboard.press("Escape");

  expect(await saved()).toBe(before);
});
