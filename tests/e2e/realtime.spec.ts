import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  type WebSocketRoute,
} from "@playwright/test";

import type { Avatar, ServerMessage, SnapshotMessage } from "@/core/realtime";

import { serverFrames } from "../fixtures/world-frames";
import { enterCampus, joinButton, openSecondTab } from "./support/campus-entry";
import { canvasDigest, expectCanvasDigest } from "./support/canvas-digest";
import {
  type FakeApi,
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
const FIRST_RECONNECT_CEILING_MS = 1_000;
// The harness artwork is small, so the two avatars sit in adjacent in-bounds
// tiles. The shared protocol fixture's coordinates are for a larger map.
const ADA = { ...serverFrames.snapshot.players[0]!, x: 1, y: 1 };
const GRACE = {
  ...serverFrames.joined.player,
  x: 2,
  y: 1,
  displayName: "Grace",
} satisfies Avatar;

function snapshotWith(...players: Avatar[]): SnapshotMessage {
  return { ...serverFrames.snapshot, map: E2E_MAP, players };
}

function joinedWith(player: Avatar): ServerMessage {
  return { ...serverFrames.joined, player };
}

function sendFrame(socket: WebSocketRoute, frame: ServerMessage) {
  socket.send(JSON.stringify(frame));
}

function admit(
  socket: WebSocketRoute,
  snapshot = snapshotWith(...serverFrames.snapshot.players),
) {
  sendFrame(socket, serverFrames.welcome);
  sendFrame(socket, snapshot);
}

async function prepareMember({
  baseURL,
  context,
  fakeApi,
  page,
}: {
  baseURL: string | undefined;
  context: BrowserContext;
  fakeApi: FakeApi;
  page: Page;
}) {
  await signIn(context, baseURL);
  await fakeApi.scriptSession(
    sessions.member(
      membership("c-3", "Cohort 3"),
      membership("c-4", "Cohort 4"),
    ),
  );
  await installSanityMapStub(page);
}

function campusMap(page: Page) {
  return page.getByRole("region", { name: "Campus map" });
}

async function enterReadyCampus(page: Page): Promise<Locator> {
  await enterCampus(page, CAMPUS_URL);
  const map = campusMap(page);
  await expect(map).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  return map.locator("canvas");
}

async function expectNoAdditionalSocket(sockets: WebSocketRoute[]) {
  const deadline = Date.now() + FIRST_RECONNECT_CEILING_MS + 200;
  await expect
    .poll(() => sockets.length === 1 && Date.now() >= deadline, {
      timeout: FIRST_RECONNECT_CEILING_MS + 1_000,
    })
    .toBe(true);
}

test("draws a snapshot and applies joined and left to the map", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const sockets: WebSocketRoute[] = [];
  world.replaceHandler((socket) => {
    sockets.push(socket);
    admit(socket, snapshotWith(ADA, GRACE));
  });
  await prepareMember({ baseURL, context, fakeApi, page });

  const canvas = await enterReadyCampus(page);
  const twoAvatars = await canvasDigest(canvas);

  sendFrame(sockets[0]!, serverFrames.left);
  await expect.poll(() => canvasDigest(canvas)).not.toBe(twoAvatars);
  const oneAvatar = await canvasDigest(canvas);

  sendFrame(sockets[0]!, joinedWith(GRACE));
  await expectCanvasDigest(canvas, twoAvatars);
  expect(await canvasDigest(canvas)).not.toBe(oneAvatar);
});

test("rebuilds from a fresh snapshot after a 1006 without stale presence", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const sockets: WebSocketRoute[] = [];
  world.replaceHandler((socket) => {
    sockets.push(socket);
    admit(
      socket,
      sockets.length === 1 ? snapshotWith(ADA, GRACE) : snapshotWith(ADA),
    );
  });
  await prepareMember({ baseURL, context, fakeApi, page });

  const canvas = await enterReadyCampus(page);
  const twoAvatars = await canvasDigest(canvas);
  sendFrame(sockets[0]!, serverFrames.left);
  await expect.poll(() => canvasDigest(canvas)).not.toBe(twoAvatars);
  const oneAvatar = await canvasDigest(canvas);
  sendFrame(sockets[0]!, joinedWith(GRACE));
  await expectCanvasDigest(canvas, twoAvatars);

  await sockets[0]!.close({ code: 1006 });

  await expect.poll(() => sockets.length).toBe(2);
  await expectCanvasDigest(canvas, oneAvatar);
  expect(sockets).toHaveLength(2);
});

test("stops after 4000 and shows the entered-elsewhere choice", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const sockets: WebSocketRoute[] = [];
  world.replaceHandler((socket) => {
    sockets.push(socket);
    admit(socket);
  });
  await prepareMember({ baseURL, context, fakeApi, page });
  await enterReadyCampus(page);

  await sockets[0]!.close({ code: 4000, reason: "entered_elsewhere" });

  await expect(
    page.getByRole("heading", {
      name: "You opened this campus somewhere else",
    }),
  ).toBeVisible();
  await expectNoAdditionalSocket(sockets);
});

test("stops the moment world announces a replacement and swallows the close that follows", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const sockets: WebSocketRoute[] = [];
  world.replaceHandler((socket) => {
    sockets.push(socket);
    admit(socket);
  });
  await prepareMember({ baseURL, context, fakeApi, page });
  await enterReadyCampus(page);

  sendFrame(sockets[0]!, serverFrames.replaced);

  await expect(
    page.getByRole("heading", {
      name: "You opened this campus somewhere else",
    }),
  ).toBeVisible();

  const otherPage = await openSecondTab(context);
  await otherPage.goto(`${CAMPUS_URL}/join`);
  await expect(joinButton(otherPage)).toBeVisible();
  await otherPage.close();
  await expect(
    page.getByRole("heading", {
      name: "You opened this campus somewhere else",
    }),
  ).toBeVisible();

  // The outcome is already terminal whether the close frame arrives or not.
  await sockets[0]!.close({ code: 1006 });
  await expectNoAdditionalSocket(sockets);
});

test("holds the reconnect budget while offline and rejoins when the browser wakes", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const sockets: WebSocketRoute[] = [];
  world.replaceHandler((socket) => {
    sockets.push(socket);
    admit(
      socket,
      sockets.length === 1 ? snapshotWith(ADA, GRACE) : snapshotWith(ADA),
    );
  });
  await prepareMember({ baseURL, context, fakeApi, page });
  await enterReadyCampus(page);

  await context.setOffline(true);
  await sockets[0]!.close({ code: 1001, reason: "server shutting down" });
  // The browser is asleep: no retry is scheduled, so no second socket yet.
  await expectNoAdditionalSocket(sockets);

  await context.setOffline(false);
  await expect.poll(() => sockets.length).toBe(2);
  await expect(campusMap(page)).toHaveAttribute("data-status", "ready");
});

test("rejoins after a stop when the member presses Reconnect", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const sockets: WebSocketRoute[] = [];
  world.replaceHandler((socket) => {
    sockets.push(socket);
    admit(socket);
  });
  await prepareMember({ baseURL, context, fakeApi, page });
  await enterReadyCampus(page);

  await sockets[0]!.close({ code: 1008, reason: "no_cohort" });
  await expect(page.getByText("You're offline in the campus")).toBeVisible();

  await page.getByRole("button", { name: "Reconnect" }).click();

  await expect.poll(() => sockets.length).toBe(2);
  await expect(campusMap(page)).toHaveAttribute("data-status", "ready");
});

test("returns to the cohort picker after 1008 not_a_member", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const sockets: WebSocketRoute[] = [];
  world.replaceHandler((socket) => {
    sockets.push(socket);
    admit(socket);
  });
  await prepareMember({ baseURL, context, fakeApi, page });
  await enterReadyCampus(page);

  await sockets[0]!.close({ code: 1008, reason: "not_a_member" });

  await expect(page).toHaveURL("/campus");
  await expect(page.getByRole("link", { name: /Cohort 3/ })).toBeVisible();
  await expectNoAdditionalSocket(sockets);
});

test("leaving the cohort closes world with presence_ended", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  let closeEvent: [number | undefined, string | undefined] | undefined;
  world.replaceHandler((socket) => {
    socket.onClose((code, reason) => {
      closeEvent = [code, reason];
    });
    admit(socket);
  });
  await prepareMember({ baseURL, context, fakeApi, page });
  await enterReadyCampus(page);

  await page.getByRole("link", { name: "Back to campuses" }).click();

  await expect(page).toHaveURL("/campus");
  await expect.poll(() => closeEvent).toEqual([1000, "presence_ended"]);
});
