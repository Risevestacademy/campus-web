import { type BrowserContext, expect, type Page } from "@playwright/test";

import { enterCampus, joinButton } from "./support/campus-entry";
import {
  type FakeApi,
  membership,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";
import { installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The KAPLAY rendering contract runs once in Chromium.",
);

const campusUrl = "/campus/c-3";

function collectKaplayWarnings(page: Page): string[] {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (/KAPLAY already initialized/.test(message.text())) {
      warnings.push(message.text());
    }
  });
  return warnings;
}

async function prepareMember({
  baseURL,
  context,
  fakeApi,
}: {
  baseURL: string | undefined;
  context: BrowserContext;
  fakeApi: FakeApi;
}) {
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.member(membership("c-3", "Cohort 3")));
}

test("renders the published entry map and follows its container size", async ({
  page,
  context,
  baseURL,
  fakeApi,
}) => {
  await prepareMember({ baseURL, context, fakeApi });
  await installSanityMapStub(page);
  const kaplayWarnings = collectKaplayWarnings(page);

  await enterCampus(page, campusUrl);

  const world = page.getByRole("region", { name: "Campus map" });
  await expect(world).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  await expect(world).toHaveAttribute("data-map-id", "campus");
  const canvas = world.locator("canvas");
  const initialSize = await canvas.evaluate((element) => {
    const { height, width } = element as HTMLCanvasElement;
    return { height, width };
  });
  expect(initialSize.width).toBeGreaterThan(0);
  expect(initialSize.height).toBeGreaterThan(0);

  await page.setViewportSize({ height: 600, width: 900 });
  await expect
    .poll(async () =>
      canvas.evaluate((element) => (element as HTMLCanvasElement).width),
    )
    .not.toBe(initialSize.width);
  expect(kaplayWarnings).toEqual([]);
});

test("reuses pre-join preparation after Join without refetching map assets", async ({
  page,
  context,
  baseURL,
  fakeApi,
}) => {
  await prepareMember({ baseURL, context, fakeApi });
  const requests = await installSanityMapStub(page);

  await page.goto(`${campusUrl}/join`);

  const join = joinButton(page);
  await expect(join).toBeVisible();
  const preparedRequestCounts = { ...requests };
  expect(preparedRequestCounts).toEqual({
    manifest: 1,
    map: 1,
    tilesets: 3,
  });

  await join.click();

  await expect(page).toHaveURL(campusUrl);
  await expect(
    page.getByRole("region", { name: "Campus map" }),
  ).toHaveAttribute("data-status", "ready", { timeout: 15_000 });
  expect(requests).toEqual(preparedRequestCounts);
});

test("reveals Join at once on repeat entry and reuses the runtime's artwork", async ({
  page,
  context,
  baseURL,
  fakeApi,
}) => {
  await signIn(context, baseURL);
  await fakeApi.scriptSession(
    sessions.member(
      membership("c-3", "Cohort 3"),
      membership("c-4", "Cohort 4"),
    ),
  );
  const requests = await installSanityMapStub(page);
  const kaplayWarnings = collectKaplayWarnings(page);

  await enterCampus(page, campusUrl);
  const world = page.getByRole("region", { name: "Campus map" });
  await expect(world).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  const firstEntryRequests = { ...requests };

  await page.getByRole("link", { name: "Back to campuses" }).click();
  await page.getByRole("link", { name: /Cohort 3/ }).click();

  await expect(joinButton(page)).toBeVisible();
  await joinButton(page).click();

  await expect(world).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  expect(requests).toEqual(firstEntryRequests);
  expect(requests).toEqual({ manifest: 1, map: 1, tilesets: 3 });
  expect(kaplayWarnings).toEqual([]);
});
