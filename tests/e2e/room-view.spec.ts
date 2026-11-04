import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  type WebSocketRoute,
} from "@playwright/test";

import type { Avatar, ServerMessage } from "@/core/realtime";

import { serverFrames } from "../fixtures/world-frames";
import { enterCampus } from "./support/campus-entry";
import {
  type FakeApi,
  type FakeWorld,
  membership,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";
import { E2E_MAP, installSanityMapStub } from "./support/sanity-stub";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);

const CAMPUS_URL = "/campus/c-3";
const ADA = {
  ...serverFrames.snapshot.players[0]!,
  x: 1,
  y: 1,
  spaceKey: "library",
};
const GRACE = {
  ...serverFrames.joined.player,
  x: 2,
  y: 1,
  displayName: "Grace Hopper",
  spaceKey: "library",
} satisfies Avatar;

const ROOM_CALL: ServerMessage = {
  type: "call",
  call: {
    url: "wss://media.example.test",
    token: "media-token",
    hearing: "room",
    audibleRadius: 6,
  },
};

function sendFrame(socket: WebSocketRoute, frame: ServerMessage) {
  socket.send(JSON.stringify(frame));
}

test("titles the meeting view with the room's name and hides it once you are alone in the room", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const sockets: WebSocketRoute[] = [];
  world.replaceHandler((socket) => {
    sockets.push(socket);
    sendFrame(socket, serverFrames.welcome);
    sendFrame(socket, {
      ...serverFrames.snapshot,
      map: E2E_MAP,
      players: [ADA, GRACE],
      spaces: [{ spaceKey: "library", name: "Library" }],
    });
    sendFrame(socket, ROOM_CALL);
  });
  await signIn(context, baseURL);
  await fakeApi.scriptSession(
    sessions.member(
      membership("c-3", "Cohort 3"),
      membership("c-4", "Cohort 4"),
    ),
  );
  await installSanityMapStub(page);
  await enterCampus(page, CAMPUS_URL);
  await expect(
    page.getByRole("region", { name: "Campus map" }),
  ).toHaveAttribute("data-status", "ready", { timeout: 15_000 });

  const heading = page.getByRole("heading", { name: "Library" });
  const graceTile = page.getByRole("button", {
    name: "Show expanded meeting view for Grace Hopper",
  });
  const shareScreen = page.getByRole("button", { name: "Share screen" });
  await expect(heading).toBeVisible();
  await expect(graceTile).toBeVisible();
  // This suite has no media server, so the call fails and the button says so.
  await expect(
    page.getByRole("alert").filter({ hasText: "Audio couldn't connect" }),
  ).toBeVisible();
  await expect(shareScreen).toHaveAttribute("aria-disabled", "true");
  await expect(shareScreen).toHaveAttribute(
    "title",
    "Share screen: the call isn't connected",
  );

  sendFrame(sockets[0]!, {
    type: "spaceChanged",
    userId: GRACE.userId,
    spaceKey: "_default",
  });

  await expect(heading).toBeHidden();
  await expect(graceTile).toBeHidden();
});

const TILE_RATIO = 16 / 9;
// The longest morph settles inside this: the tiles' morph runs 260 ms.
const MORPH_MS = 700;

type Box = Readonly<{ x: number; y: number; width: number; height: number }>;

function tileBoxes(page: Page): Promise<Box[]> {
  return page.getByTestId("meeting-tile").evaluateAll((tiles) =>
    tiles.map((tile) => {
      const { x, y, width, height } = tile.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
}

// `layout` animates with scale, so a tile stretches on any frame whose width
// and height scale differently. Only frames show that: a settled tile cannot.
function sampleRatiosThroughMorph(page: Page): Promise<number[]> {
  return page.evaluate(async (durationMs) => {
    const ratios: number[] = [];
    const end = performance.now() + durationMs;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      for (const tile of document.querySelectorAll(
        "[data-testid='meeting-tile']",
      )) {
        const { width, height } = tile.getBoundingClientRect();
        ratios.push(width / height);
      }
    }
    return ratios;
  }, MORPH_MS);
}

async function expectTilesHeldTheirRatio(sampling: Promise<number[]>) {
  const ratios = await sampling;
  expect(ratios.length).toBeGreaterThan(0);
  for (const ratio of ratios) {
    expect(Math.abs(ratio / TILE_RATIO - 1)).toBeLessThan(0.02);
  }
}

type FourPersonMeeting = Readonly<{
  baseURL: string | undefined;
  context: BrowserContext;
  fakeApi: FakeApi;
  page: Page;
  viewport: Readonly<{ width: number; height: number }>;
  world: FakeWorld;
}>;

async function enterFourPersonMeeting({
  baseURL,
  context,
  fakeApi,
  page,
  viewport,
  world,
}: FourPersonMeeting): Promise<Locator> {
  world.replaceHandler((socket) => {
    sendFrame(socket, serverFrames.welcome);
    sendFrame(socket, {
      ...serverFrames.snapshot,
      map: E2E_MAP,
      players: [
        ADA,
        GRACE,
        { ...GRACE, userId: "user-lin", displayName: "Lin Clark" },
        { ...GRACE, userId: "user-kay", displayName: "Kay Giles" },
      ],
      spaces: [{ spaceKey: "library", name: "Library" }],
    });
    sendFrame(socket, ROOM_CALL);
  });
  await signIn(context, baseURL);
  await fakeApi.scriptSession(
    sessions.member(
      membership("c-3", "Cohort 3"),
      membership("c-4", "Cohort 4"),
    ),
  );
  await installSanityMapStub(page);
  await page.setViewportSize(viewport);
  await enterCampus(page, CAMPUS_URL);

  const stripTile = page.getByRole("button", {
    name: "Show expanded meeting view for Grace Hopper",
  });
  await expect(stripTile).toBeVisible();
  return stripTile;
}

async function focusViewBoxes(page: Page) {
  const stage = await page
    .getByRole("button", { name: "Restore equal meeting view" })
    .locator("xpath=ancestor::*[@data-testid='meeting-tile']")
    .boundingBox();
  const rail = (await tileBoxes(page))
    .filter(({ width }) => width < stage!.width)
    .toSorted((first, second) => first.y - second.y);
  return { stage: stage!, rail };
}

test("keeps every tile 16:9 through the grid, the rail and the morphs between them", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const stripTile = await enterFourPersonMeeting({
    baseURL,
    context,
    fakeApi,
    page,
    viewport: { width: 1440, height: 900 },
    world,
  });

  const toGrid = sampleRatiosThroughMorph(page);
  await stripTile.click();
  await expectTilesHeldTheirRatio(toGrid);

  const grid = await tileBoxes(page);
  expect(grid).toHaveLength(4);
  expect(new Set(grid.map(({ y }) => Math.round(y))).size).toBe(2);

  // The share pill sits on the control bar and is about 52 px tall with its gap.
  const controls = await page
    .getByRole("complementary", { name: "Campus controls" })
    .boundingBox();
  for (const { y, height } of grid) {
    expect(y + height).toBeLessThanOrEqual(controls!.y - 52);
  }

  const toFocus = sampleRatiosThroughMorph(page);
  await page.getByRole("button", { name: "Focus Grace Hopper" }).click();
  await expectTilesHeldTheirRatio(toFocus);

  const { stage, rail } = await focusViewBoxes(page);

  expect(rail).toHaveLength(3);
  expect(new Set(rail.map(({ x }) => x)).size).toBe(1);
  expect(rail[1]!.y).toBeGreaterThanOrEqual(rail[0]!.y + rail[0]!.height);
  expect(rail[2]!.y).toBeGreaterThanOrEqual(rail[1]!.y + rail[1]!.height);
  expect(stage.x).toBeGreaterThanOrEqual(rail[0]!.x + rail[0]!.width);
});

test("keeps a wide window's spare width outside the rail and the stage", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const stripTile = await enterFourPersonMeeting({
    baseURL,
    context,
    fakeApi,
    page,
    viewport: { width: 2120, height: 1040 },
    world,
  });

  await stripTile.click();
  await page.getByRole("button", { name: "Focus Grace Hopper" }).click();

  const section = page.getByRole("region", {
    name: "Meeting participant tiles",
  });
  await expect(async () => {
    const { stage, rail } = await focusViewBoxes(page);
    const { x, width } = (await section.boundingBox())!;
    const leftSpace = rail[0]!.x - x;
    const rightSpace = x + width - (stage.x + stage.width);

    expect(rightSpace).toBeGreaterThan(100);
    expect(stage.x - (rail[0]!.x + rail[0]!.width)).toBeLessThanOrEqual(8);
    // The rail sits 2 px further in, inside the scroller's focus-ring padding.
    expect(Math.abs(leftSpace - rightSpace)).toBeLessThanOrEqual(3);
  }).toPass();
});

function sampleTrayThroughMorph(page: Page) {
  return page.evaluate(async (durationMs) => {
    const section = document.querySelector(
      "[aria-label='Meeting participant tiles']",
    )!;
    const tray = document.querySelector("[data-testid='meeting-strip-tray']")!;
    const frames: {
      sectionWidth: number;
      sectionColor: string;
      trayOpacity: string;
    }[] = [];
    const end = performance.now() + durationMs;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      frames.push({
        sectionWidth: section.getBoundingClientRect().width,
        sectionColor: getComputedStyle(section).backgroundColor,
        trayOpacity: getComputedStyle(tray).opacity,
      });
    }
    return frames;
  }, MORPH_MS);
}

test("paints the strip's tray only after the tiles land as the view closes", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const stripTile = await enterFourPersonMeeting({
    baseURL,
    context,
    fakeApi,
    page,
    viewport: { width: 2120, height: 1040 },
    world,
  });
  const section = page.getByRole("region", {
    name: "Meeting participant tiles",
  });
  const compactWidth = (await section.boundingBox())!.width;

  await stripTile.click();
  await expect(
    page.getByRole("button", { name: "Focus Grace Hopper" }),
  ).toBeVisible();
  await sampleTrayThroughMorph(page);

  const closing = sampleTrayThroughMorph(page);
  await page.getByRole("switch", { name: "Use grid view" }).click();

  const stillLarge = (await closing).filter(
    ({ sectionWidth }) => sectionWidth > compactWidth * 1.25,
  );
  expect(stillLarge.length).toBeGreaterThan(0);
  for (const { sectionColor, trayOpacity } of stillLarge) {
    expect(sectionColor).toBe("rgba(0, 0, 0, 0)");
    expect(trayOpacity).toBe("0");
  }

  await expect(page.getByTestId("meeting-strip-tray")).toHaveCSS(
    "opacity",
    "1",
  );
});
