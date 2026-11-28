import { expect, type Page, test } from "@playwright/test";

import { blockPostHog, rejectAnalyticsUpFront } from "./support/analytics";

// Playwright loads the same .env the build read, so this matches the build.
const IS_PUBLIC_SITE = Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim());

test.beforeEach(async ({ context }) => {
  await blockPostHog(context);
  await rejectAnalyticsUpFront(context);
});

function metaContent(page: Page, selector: string) {
  return page.locator(`head meta[${selector}]`).getAttribute("content");
}

async function expectImageAt(page: Page, url: string | null) {
  expect(url).toBeTruthy();
  const response = await page.request.get(url ?? "");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^image\//);
}

test("the landing page carries its title, description and share card", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Campus by Rise");
  expect(await metaContent(page, 'name="description"')).toBeTruthy();
  expect(await metaContent(page, 'property="og:title"')).toBe("Campus by Rise");
  expect(await metaContent(page, 'name="twitter:card"')).toBe(
    "summary_large_image",
  );

  // On a local build the metadata base falls back to this server's origin.
  const ogImage = await metaContent(page, 'property="og:image"');
  await expectImageAt(page, new URL(ogImage ?? "", page.url()).pathname);
});

test("every declared icon and the manifest resolve", async ({ page }) => {
  await page.goto("/");

  const iconLinks = page.locator(
    'head link[rel="icon"], head link[rel="apple-touch-icon"]',
  );
  for (const href of await iconLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  )) {
    await expectImageAt(page, href);
  }

  const manifestHref = await page
    .locator('head link[rel="manifest"]')
    .getAttribute("href");
  const manifest = await page.request.get(manifestHref ?? "");
  expect(manifest.status()).toBe(200);

  const { icons } = await manifest.json();
  for (const { src } of icons) await expectImageAt(page, src);
});

test("a private page has its own tab title and is never indexed", async ({
  page,
}) => {
  await page.goto("/sign-in");

  await expect(page).toHaveTitle("Sign in · Campus by Rise");
  expect(await metaContent(page, 'name="robots"')).toBe("noindex, nofollow");
});

test.describe("a deployment without a site URL", () => {
  test.skip(IS_PUBLIC_SITE, "this build is the public site");

  test("keeps every crawler out", async ({ page }) => {
    const robots = await (await page.request.get("/robots.txt")).text();

    expect(robots).toMatch(/^Disallow: \/$/m);
  });

  test("marks the landing page noindex", async ({ page }) => {
    await page.goto("/");

    expect(await metaContent(page, 'name="robots"')).toBe("noindex, nofollow");
  });
});
