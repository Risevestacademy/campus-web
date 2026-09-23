import { expect, test } from "@playwright/test";

test("serves the root route", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("Campus by Rise");
});
