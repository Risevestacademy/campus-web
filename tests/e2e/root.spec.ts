import { expect, test } from "@playwright/test";

test("serves a neutral application shell without product UI", async ({
  page,
}) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("Campus by Rise");
  await expect(page.locator("body > :visible")).toHaveCount(0);
});
