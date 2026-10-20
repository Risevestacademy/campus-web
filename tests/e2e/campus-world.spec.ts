import { type BrowserContext, expect, type Page } from "@playwright/test";

import { enterCampus, joinButton } from "./support/campus-entry";
import {
  canvasDigest,
  expectCanvasDigest,
  settledDigest,
} from "./support/canvas-digest";
import {
  admitToWorld,
  type FakeApi,
  membership,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";
import { installSanityMapStub } from "./support/sanity-stub";
import { type CapturedMove, readMove } from "./support/world-moves";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The KAPLAY rendering contract runs once in Chromium.",
);

const campusUrl = "/campus/c-3";

const movementInputs = [
  { key: "ArrowUp", direction: "up" },
  { key: "ArrowDown", direction: "down" },
  { key: "ArrowLeft", direction: "left" },
  { key: "ArrowRight", direction: "right" },
  { key: "w", direction: "up" },
  { key: "s", direction: "down" },
  { key: "a", direction: "left" },
  { key: "d", direction: "right" },
] as const;

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

// The 4 × 3 harness map is smaller than the viewport at every level, so each
// level draws one centred frame and frames compare by digest.
test("zooms the map by key and button, and remembers the level", async ({
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
  const canvas = world.locator("canvas");
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  const savedZoom = () =>
    page.evaluate(() => window.localStorage.getItem("campus-world-zoom"));

  const atTwo = await settledDigest(canvas);

  await canvas.press("-");
  await expect.poll(savedZoom).toBe("1");
  await expect.poll(() => canvasDigest(canvas)).not.toBe(atTwo);
  const atOne = await settledDigest(canvas);

  await canvas.press("=");
  await expect.poll(savedZoom).toBe("2");
  await expectCanvasDigest(canvas, atTwo);

  await zoomIn.click();
  await expect.poll(savedZoom).toBe("3");
  await expect.poll(() => canvasDigest(canvas)).not.toBe(atTwo);
  const atThree = await settledDigest(canvas);
  expect(atThree).not.toBe(atOne);

  // The button press left focus on the map, so keys still reach it.
  await page.keyboard.press("-");
  await expect.poll(savedZoom).toBe("2");
  await expectCanvasDigest(canvas, atTwo);

  await zoomIn.click();
  await expect.poll(savedZoom).toBe("3");
  await expectCanvasDigest(canvas, atThree);

  await enterCampus(page, campusUrl);
  await expect(world).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  await expectCanvasDigest(canvas, atThree);
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

for (const { key, direction } of movementInputs) {
  test(`sends ${direction} movement frame for ${key}`, async ({
    page,
    context,
    baseURL,
    fakeApi,
    world,
  }, testInfo) => {
    const moves: CapturedMove[] = [];
    let focused = false;

    try {
      world.replaceHandler((socket) => {
        socket.onMessage((message) => {
          const move = readMove(message);
          if (move) moves.push(move);
        });
        admitToWorld(socket);
      });
      await prepareMember({ baseURL, context, fakeApi });
      await installSanityMapStub(page);

      await enterCampus(page, campusUrl);

      const worldRegion = page.getByRole("region", { name: "Campus map" });
      await expect(worldRegion).toHaveAttribute("data-status", "ready", {
        timeout: 15_000,
      });
      const canvas = worldRegion.locator("canvas");
      await expect(canvas).toBeFocused();
      focused = true;

      await page.keyboard.down(key);
      try {
        await expect
          .poll(() => moves[0])
          .toEqual({
            type: "move",
            direction,
            seq: 1,
          });
      } finally {
        await page.keyboard.up(key);
      }
    } finally {
      await testInfo.attach("movement-debug.json", {
        body: JSON.stringify({ key, direction, focused, moves }, null, 2),
        contentType: "application/json",
      });
    }
  });
}
