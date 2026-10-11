import { type BrowserContext, expect } from "@playwright/test";

import { enterCampus, joinLink } from "./support/campus-entry";
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

  const join = joinLink(page);
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

test("recovers when retrying after Sanity fails", async ({
  page,
  context,
  baseURL,
  fakeApi,
}) => {
  await prepareMember({ baseURL, context, fakeApi });
  await installSanityMapStub(page, { queryStatuses: [503, 200] });

  await page.goto(`${campusUrl}/join`);

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "We couldn't prepare your campus." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await joinLink(page).click();

  const world = page.getByRole("region", { name: "Campus map" });
  await expect(world).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  await expect(world).toHaveAttribute("data-map-id", "campus");
});

test("rehydrates consumed artwork before Join on repeat entry", async ({
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
  let releaseRepeatTilesets: (() => void) | undefined;
  const repeatTilesets = new Promise<void>((resolve) => {
    releaseRepeatTilesets = resolve;
  });
  const requests = await installSanityMapStub(page, {
    tilesetResponseGate: { afterRequests: 3, wait: repeatTilesets },
  });

  await enterCampus(page, campusUrl);
  await expect(
    page.getByRole("region", { name: "Campus map" }),
  ).toHaveAttribute("data-status", "ready", { timeout: 15_000 });

  await page.getByRole("link", { name: "Back to campuses" }).click();
  await page.getByRole("link", { name: /Cohort 3/ }).click();

  await expect(
    page.getByRole("status", { name: "Preparing campus" }),
  ).toBeVisible();
  await expect(joinLink(page)).toHaveCount(0);
  await expect.poll(() => requests.tilesets).toBe(6);

  releaseRepeatTilesets?.();
  await expect(joinLink(page)).toBeVisible();
  await joinLink(page).click();

  const world = page.getByRole("region", { name: "Campus map" });
  await expect(world).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  await expect(page.getByText("Loading campus map…")).toHaveCount(0);
  expect(requests).toEqual({ manifest: 1, map: 1, tilesets: 6 });
});
