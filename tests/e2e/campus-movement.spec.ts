import {
  type BrowserContext,
  expect,
  type Page,
  type WebSocketRoute,
} from "@playwright/test";

import type { Avatar, ServerMessage } from "@/core/realtime";

import { serverFrames } from "../fixtures/world-frames";
import { enterCampus } from "./support/campus-entry";
import {
  canvasDigest,
  expectCanvasDigest,
  settledDigest,
} from "./support/canvas-digest";
import {
  type FakeApi,
  type FakeWorld,
  membership,
  sessions,
  signIn,
  test,
} from "./support/fake-api-fixture";
import { E2E_MAP, installSanityMapStub } from "./support/sanity-stub";
import { type CapturedMove, readMove } from "./support/world-moves";

test.skip(
  Boolean(process.env.PLAYWRIGHT_BASE_URL),
  "Needs the local fake auth API started by playwright.config.ts.",
);
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "The KAPLAY rendering contract runs once in Chromium.",
);

// The harness map is 4 × 3 tiles with one wall at (0, 0), smaller than the
// viewport, so the camera stays centred and frames compare by digest.
const CAMPUS_URL = "/campus/c-3";
const ADA = serverFrames.snapshot.players[0]!;
const GRACE: Avatar = { ...serverFrames.joined.player, displayName: "Grace" };

type Placement = Pick<Avatar, "facing" | "x" | "y">;
type ArrivedMove = CapturedMove & { arrivedAt: number };

interface Fixtures {
  baseURL: string | undefined;
  context: BrowserContext;
  fakeApi: FakeApi;
  page: Page;
  world: FakeWorld;
}

interface WorldScript {
  answer?: (socket: WebSocketRoute, move: CapturedMove) => void;
  players: Avatar[];
  stepMs: number;
}

function placed(player: Avatar, placement: Placement): Avatar {
  return { ...player, ...placement };
}

function snapshotOf(...players: Avatar[]): ServerMessage {
  return { ...serverFrames.snapshot, map: E2E_MAP, players };
}

function send(socket: WebSocketRoute, frame: ServerMessage) {
  socket.send(JSON.stringify(frame));
}

async function enterWorld(
  { baseURL, context, fakeApi, page, world }: Fixtures,
  { answer, players, stepMs }: WorldScript,
) {
  const moves: ArrivedMove[] = [];
  let connected: WebSocketRoute | undefined;
  world.replaceHandler((socket) => {
    connected = socket;
    socket.onMessage((message) => {
      const move = readMove(message);
      if (!move) return;
      moves.push({ ...move, arrivedAt: Date.now() });
      answer?.(socket, move);
    });
    send(socket, { ...serverFrames.welcome, stepMs });
    send(socket, snapshotOf(...players));
  });
  await signIn(context, baseURL);
  await fakeApi.scriptSession(sessions.member(membership("c-3", "Cohort 3")));
  await installSanityMapStub(page);

  await enterCampus(page, CAMPUS_URL);

  const region = page.getByRole("region", { name: "Campus map" });
  await expect(region).toHaveAttribute("data-status", "ready", {
    timeout: 15_000,
  });
  const canvas = region.locator("canvas");
  await expect(canvas).toBeFocused();
  const socket = () => {
    if (!connected) throw new Error("world never received a socket");
    return connected;
  };
  return { canvas, moves, socket };
}

async function holdUntil(page: Page, key: string, reached: () => boolean) {
  await page.keyboard.down(key);
  try {
    await expect.poll(reached).toBe(true);
  } finally {
    await page.keyboard.up(key);
  }
}

function indexAfter(digests: string[], wanted: string[], start: number) {
  return digests.findIndex(
    (digest, index) => index > start && wanted.includes(digest),
  );
}

test("paces a held key to one move per stepMs with rising seq", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const stepMs = 200;
  let x = 0;
  const { moves } = await enterWorld(
    { baseURL, context, fakeApi, page, world },
    {
      stepMs,
      players: [placed(ADA, { x, y: 1, facing: "right" })],
      answer: (socket, { seq }) => {
        const moved = x < E2E_MAP.width - 1;
        if (moved) x += 1;
        send(socket, {
          type: "moveResult",
          seq,
          outcome: moved ? "moved" : "blocked",
          player: { userId: ADA.userId, x, y: 1, facing: "right" },
        });
      },
    },
  );

  await holdUntil(page, "ArrowRight", () => moves.length >= 4);

  const walked = moves.slice(0, 4);
  expect(walked.map(({ direction, seq }) => ({ direction, seq }))).toEqual([
    { direction: "right", seq: 1 },
    { direction: "right", seq: 2 },
    { direction: "right", seq: 3 },
    { direction: "right", seq: 4 },
  ]);
  const gaps = walked
    .slice(1)
    .map((move, index) => move.arrivedAt - walked[index]!.arrivedAt);
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(stepMs * 0.75);
});

test("snaps back facing the new way when world blocks the step", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  const { canvas, moves, socket } = await enterWorld(
    { baseURL, context, fakeApi, page, world },
    { stepMs: 400, players: [placed(ADA, { x: 1, y: 1, facing: "right" })] },
  );
  const facingRight = await settledDigest(canvas);
  send(socket(), snapshotOf(placed(ADA, { x: 1, y: 1, facing: "down" })));
  await expect.poll(() => canvasDigest(canvas)).not.toBe(facingRight);
  const facingDown = await settledDigest(canvas);

  await holdUntil(page, "ArrowRight", () => moves.length >= 1);
  const predicted = await settledDigest(canvas);

  expect(moves.map(({ direction, seq }) => ({ direction, seq }))).toEqual([
    { direction: "right", seq: 1 },
  ]);
  expect([facingDown, facingRight]).not.toContain(predicted);
  send(socket(), {
    type: "moveResult",
    seq: 1,
    outcome: "blocked",
    player: { userId: ADA.userId, x: 1, y: 1, facing: "right" },
  });
  await expectCanvasDigest(canvas, facingRight);
});

test("walks a remote three-tile jump one orthogonal tile at a time", async ({
  baseURL,
  context,
  fakeApi,
  page,
  world,
}) => {
  // Ten 16 ms animation frames, so the fake clock lands on every tile.
  const stepMs = 160;
  const ada = placed(ADA, { x: 3, y: 0, facing: "down" });
  const grace = (placement: Placement) => placed(GRACE, placement);
  await page.clock.install();
  const { canvas, socket } = await enterWorld(
    { baseURL, context, fakeApi, page, world },
    { stepMs, players: [ada, grace({ x: 0, y: 1, facing: "down" })] },
  );
  async function drawnWith(placement: Placement) {
    send(socket(), snapshotOf(ada, grace(placement)));
    return settledDigest(canvas);
  }
  // On a step's last frame Grace may already face the next step's way.
  const firstTile = [await drawnWith({ x: 1, y: 1, facing: "right" })];
  const cornerTile = [
    await drawnWith({ x: 2, y: 1, facing: "right" }),
    await drawnWith({ x: 2, y: 1, facing: "down" }),
  ];
  const lastTile = [await drawnWith({ x: 2, y: 2, facing: "down" })];
  await drawnWith({ x: 0, y: 1, facing: "down" });

  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.clock.runFor(32);
  send(socket(), {
    type: "moved",
    players: [{ userId: GRACE.userId, x: 2, y: 2, facing: "down" }],
  });
  const frames: string[] = [];
  for (let frame = 0; frame < 40; frame += 1) {
    await page.clock.runFor(16);
    frames.push(await canvasDigest(canvas));
  }

  const first = indexAfter(frames, firstTile, -1);
  const corner = indexAfter(frames, cornerTile, first);
  const last = indexAfter(frames, lastTile, corner);
  expect(first).toBeGreaterThanOrEqual(0);
  expect(corner).toBeGreaterThan(first);
  expect(last).toBeGreaterThan(corner);
});
