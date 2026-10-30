import type { Tile } from "campus-world-map";
import type { KAPLAYOpt } from "kaplay";
import { describe, expect, it, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import {
  createWorldMovementChannel,
  type Direction,
  type MovedMessage,
  type MoveResultMessage,
  parseServerMessage,
  type Player,
} from "@/core/realtime";
import { addAvatarLayer } from "@/features/campus-world/game/avatar-layer";
import { createCampusCamera } from "@/features/campus-world/game/campus-camera";
import { createOwnAvatarMovement } from "@/features/campus-world/game/own-avatar-movement";
import { createRemoteAvatarMovement } from "@/features/campus-world/game/remote-avatar-movement";
import {
  cameraScale,
  clampCamera,
  visibleArea,
  ZOOM_LEVELS,
  type ZoomLevel,
} from "@/features/campus-world/services/camera";
import {
  type PendingMove,
  reconcile,
} from "@/features/campus-world/services/movement/reconcile";
import {
  isWalkable,
  predictStep,
  stepFrom,
} from "@/features/campus-world/services/movement/step";
import { tileCentre } from "@/features/campus-world/services/tile-centre";
import { loadZoomLevel } from "@/features/campus-world/services/zoom-preference";
import { fakeKaplay } from "@/features/campus-world/testing/fake-kaplay";
import {
  movementLayout,
  walksOneTileAtATime,
} from "@/features/campus-world/testing/movement";

// Sessions written from world's movement rules (apps/world/src/movement) on
// the 5 × 4 test layout, wall at (2, 1). Frames are kept as world sends them
// and go through parseServerMessage, as they will off the socket.

const ADA = "ada";

type SessionEvent = { send: Direction } | { receive: unknown };

interface OwnSession {
  name: string;
  start: Player;
  events: SessionEvent[];
  corrections: number;
}

function moveResult(
  seq: number,
  outcome: string,
  at: Omit<Player, "userId">,
): { receive: unknown } {
  return {
    receive: {
      type: "moveResult",
      seq,
      outcome,
      player: { userId: ADA, ...at },
    },
  };
}

const OWN_SESSIONS: OwnSession[] = [
  {
    name: "a blocked step mid-burst, predicted, so nothing snaps",
    start: { userId: ADA, x: 0, y: 1, facing: "down" },
    events: [
      { send: "right" },
      { send: "right" },
      { send: "down" },
      moveResult(1, "moved", { x: 1, y: 1, facing: "right" }),
      moveResult(2, "blocked", { x: 1, y: 1, facing: "right" }),
      moveResult(3, "moved", { x: 1, y: 2, facing: "down" }),
    ],
    corrections: 0,
  },
  {
    name: "too_fast mid-burst, then walking again at stepMs",
    start: { userId: ADA, x: 0, y: 3, facing: "right" },
    events: [
      { send: "right" },
      { send: "right" },
      { send: "right" },
      moveResult(1, "moved", { x: 1, y: 3, facing: "right" }),
      moveResult(2, "too_fast", { x: 1, y: 3, facing: "right" }),
      moveResult(3, "moved", { x: 2, y: 3, facing: "right" }),
      { send: "right" },
      moveResult(4, "moved", { x: 3, y: 3, facing: "right" }),
    ],
    corrections: 1,
  },
  {
    name: "an outcome world added after the last world:types",
    start: { userId: ADA, x: 0, y: 0, facing: "down" },
    events: [
      { send: "right" },
      moveResult(1, "teleported", { x: 0, y: 0, facing: "down" }),
      { send: "down" },
      moveResult(2, "moved", { x: 0, y: 1, facing: "down" }),
    ],
    corrections: 1,
  },
];

function readMoveResult(frame: unknown): MoveResultMessage {
  const result = parseServerMessage(JSON.stringify(frame));

  if (!result.ok || result.message.type !== "moveResult") {
    throw new Error("the session holds a frame that is not a moveResult");
  }
  return result.message;
}

function play({ start, events }: OwnSession) {
  let drawn = start;
  let pending: PendingMove[] = [];
  let lastAnswer = start;
  let corrections = 0;
  let correctionsOnMoved = 0;

  for (const event of events) {
    if ("send" in event) {
      pending = [
        ...pending,
        { seq: pending.length + 1, direction: event.send },
      ];
      drawn = predictStep(drawn, event.send, movementLayout);
      continue;
    }

    const answer = readMoveResult(event.receive);
    const reconciled = reconcile(pending, answer, movementLayout);
    const corrected =
      JSON.stringify(reconciled.player) !== JSON.stringify(drawn);

    corrections += corrected ? 1 : 0;
    correctionsOnMoved += corrected && answer.outcome === "moved" ? 1 : 0;
    ({ pending, player: drawn } = reconciled);
    lastAnswer = answer.player;
  }

  return { corrections, correctionsOnMoved, drawn, lastAnswer, pending };
}

interface RemoteGap {
  name: string;
  drawnAt: Tile;
  moved: unknown;
  path: Tile[];
}

const REMOTE_GAPS: RemoteGap[] = [
  {
    name: "a three-tile gap in one moved frame",
    drawnAt: { x: 0, y: 2 },
    moved: {
      type: "moved",
      players: [{ userId: "grace", x: 2, y: 3, facing: "down" }],
    },
    path: [
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ],
  },
  {
    name: "a three-tile gap whose across-first route meets the wall",
    drawnAt: { x: 1, y: 1 },
    moved: {
      type: "moved",
      players: [{ userId: "grace", x: 3, y: 2, facing: "right" }],
    },
    path: [
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ],
  },
];

function readMoved(frame: unknown): MovedMessage {
  const result = parseServerMessage(JSON.stringify(frame));
  if (!result.ok || result.message.type !== "moved") {
    throw new Error("the gap holds no moved frame with a player in it");
  }
  return result.message;
}

function playRemoteGap({ drawnAt, moved, path }: RemoteGap) {
  const presence = createPresenceStore();
  const movement = createWorldMovementChannel();
  const welcome = {
    type: "welcome" as const,
    userId: ADA,
    connectionId: "connection-1",
    heartbeatSeconds: 30,
    stepMs: 100,
    tickMs: 50,
    displayName: "Ada",
    spriteKey: null,
  };
  const snapshot = {
    type: "snapshot" as const,
    map: { id: "campus", version: "v1", width: 5, height: 4 },
    players: [
      {
        userId: ADA,
        x: 0,
        y: 0,
        facing: "down" as const,
        displayName: "Ada",
        spriteKey: null,
        status: "available" as const,
        spaceKey: "_default",
      },
      {
        userId: "grace",
        ...drawnAt,
        facing: "down" as const,
        displayName: "Grace",
        spriteKey: null,
        status: "available" as const,
        spaceKey: "_default",
      },
    ],
    spaces: [],
  };
  presence.getState().apply(welcome);
  presence.getState().apply(snapshot);
  movement.apply(welcome);
  movement.apply(snapshot);
  const controller = createRemoteAvatarMovement({
    layout: movementLayout,
    movement,
    prefersReducedMotion: () => false,
    readPresence: presence.getState,
  });
  const message = readMoved(moved);
  presence.getState().apply(message);
  movement.apply(message);

  const walked = path.map(() => {
    controller.update(100);
    const player = controller.readPlayers().get("grace");
    if (!player) throw new Error("the remote player disappeared while walking");
    return { x: player.x, y: player.y };
  });
  controller.stop();

  return { target: message.players[0]!, walked };
}

describe("own-avatar prediction against recorded moveResults", () => {
  it.each(OWN_SESSIONS)("$name", (session) => {
    const played = play(session);

    expect(played.correctionsOnMoved).toBe(0);
    expect(played.corrections).toBe(session.corrections);
    expect(played.pending).toEqual([]);
    expect(played.drawn).toEqual(played.lastAnswer);
  });
});

function startPacedOwnAvatar(start: Omit<Player, "userId">) {
  const presence = createPresenceStore();
  const movement = createWorldMovementChannel();
  const sent: Array<{ direction: Direction; seq: number }> = [];
  const corrections: string[] = [];
  const welcome = {
    type: "welcome" as const,
    userId: ADA,
    connectionId: "connection-1",
    heartbeatSeconds: 30,
    stepMs: 100,
    tickMs: 50,
    displayName: "Ada",
    spriteKey: null,
  };
  const snapshot = {
    type: "snapshot" as const,
    map: { id: "campus", version: "v1", width: 5, height: 4 },
    players: [
      {
        userId: ADA,
        ...start,
        displayName: "Ada",
        spriteKey: null,
        status: "available" as const,
        spaceKey: "_default",
      },
    ],
    spaces: [],
  };
  movement.bind(({ direction, seq }) => {
    sent.push({ direction, seq });
    return true;
  });
  presence.getState().apply(welcome);
  presence.getState().apply(snapshot);
  movement.apply(welcome);
  movement.apply(snapshot);
  const controller = createOwnAvatarMovement({
    layout: movementLayout,
    movement,
    onMoveCorrected: (outcome) => corrections.push(outcome),
    prefersReducedMotion: () => false,
    readPresence: presence.getState,
  });

  function receive(result: unknown) {
    const message = readMoveResult(result);
    presence.getState().apply(message);
    movement.apply(message);
    return message;
  }

  return { controller, corrections, receive, sent };
}

describe("own-avatar input pacing", () => {
  it("holds one tile per stepMs and reports a refused move", () => {
    const { controller, corrections, receive, sent } = startPacedOwnAvatar({
      x: 0,
      y: 0,
      facing: "right",
    });

    controller.update({ deltaMs: 0, held: ["right"], pressed: "right" });
    controller.update({ deltaMs: 99, held: ["right"], pressed: null });
    expect(sent).toEqual([{ direction: "right", seq: 1 }]);

    controller.update({ deltaMs: 1, held: ["right"], pressed: null });
    expect(sent).toEqual([
      { direction: "right", seq: 1 },
      { direction: "right", seq: 2 },
    ]);

    const refused = receive({
      type: "moveResult",
      seq: 2,
      outcome: "too_fast",
      player: { userId: ADA, x: 1, y: 0, facing: "right" },
    });

    expect(corrections).toEqual(["too_fast"]);
    expect(controller.readPlayer()).toEqual(refused.player);
  });

  it("reports nothing while held into a wall it predicted", () => {
    const facingWall = { x: 1, y: 1, facing: "right" as const };
    const { controller, corrections, receive, sent } =
      startPacedOwnAvatar(facingWall);

    controller.update({ deltaMs: 0, held: ["right"], pressed: "right" });
    for (let frame = 0; frame < 9; frame += 1) {
      controller.update({ deltaMs: 100, held: ["right"], pressed: null });
    }
    for (const { seq } of sent) {
      receive(moveResult(seq, "blocked", facingWall).receive);
    }

    expect(sent).toHaveLength(10);
    expect(corrections).toEqual([]);
    expect(controller.readPlayer()).toEqual({ userId: ADA, ...facingWall });
  });
});

describe("remote avatars walk a moved gap", () => {
  it.each(REMOTE_GAPS)("$name", (gap) => {
    const { target, walked } = playRemoteGap(gap);

    expect(walked).toEqual(gap.path);
    expect(walked.at(-1)).toEqual({ x: target.x, y: target.y });
    expect(walksOneTileAtATime(gap.drawnAt, walked)).toBe(true);
    expect(walked.every((tile) => isWalkable(movementLayout, tile))).toBe(true);
  });
});

const CAMERA_MAP = { height: 40, tileheight: 16, tilewidth: 16, width: 60 };
const CAMERA_LAYOUT = { ...movementLayout, widthTiles: 60, heightTiles: 40 };
const CAMERA_WORLD = { height: 640, width: 960 };

// world answers each move one frame after it arrives.
function startCameraWorld(refuses: (seq: number, target: Tile) => boolean) {
  // Each world starts at the default level, whatever an earlier one saved.
  window.localStorage.clear();
  const fake = fakeKaplay({ autoDraw: false });
  fake.kaplay({} as KAPLAYOpt);
  const context = fake.contexts[0]!;
  const { k } = context;
  const presence = createPresenceStore();
  const movement = createWorldMovementChannel();
  const answers: unknown[] = [];
  const corrections: string[] = [];
  let at = { x: 30, y: 20 };
  movement.bind(({ seq, direction }) => {
    const target = stepFrom(at, direction);
    const refused = refuses(seq, target);
    if (!refused) at = target;
    answers.push({
      type: "moveResult",
      seq,
      outcome: refused ? "blocked" : "moved",
      player: { userId: ADA, ...at, facing: direction },
    });
    return true;
  });
  const welcome = {
    type: "welcome" as const,
    userId: ADA,
    connectionId: "connection-1",
    heartbeatSeconds: 30,
    stepMs: 100,
    tickMs: 50,
    displayName: "Ada",
    spriteKey: null,
  };
  const snapshot = {
    type: "snapshot" as const,
    map: { id: "campus", version: "v1", width: 60, height: 40 },
    players: [
      {
        userId: ADA,
        ...at,
        facing: "right" as const,
        displayName: "Ada",
        spriteKey: null,
        status: "available" as const,
        spaceKey: "_default",
      },
    ],
    spaces: [],
  };
  presence.getState().apply(welcome);
  presence.getState().apply(snapshot);
  movement.apply(welcome);
  movement.apply(snapshot);
  const canvas = document.createElement("canvas");
  canvas.setPointerCapture = vi.fn();
  const camera = createCampusCamera(k, {
    canvas,
    map: CAMERA_MAP,
    onZoomChanged: () => undefined,
    prefersReducedMotion: () => false,
    start: tileCentre(at, CAMERA_MAP),
  });
  addAvatarLayer(k, {
    camera,
    layout: CAMERA_LAYOUT,
    map: CAMERA_MAP,
    movement,
    onMoveCorrected: (outcome) => corrections.push(outcome),
    readPresence: presence.getState,
  });

  // Runs one 16 ms frame and returns where you are drawn.
  function frame(): Tile {
    for (const answerFrame of answers.splice(0)) {
      const answer = readMoveResult(answerFrame);
      presence.getState().apply(answer);
      movement.apply(answer);
    }
    vi.mocked(k.drawCircle).mockClear();
    context.updateFrame(16);
    context.drawFrame();
    return vi
      .mocked(k.drawCircle)
      .mock.calls.map(([options]) => options)
      .find((options) => options.outline !== undefined)!.pos!;
  }

  return { canvas, context, corrections, frame, k };
}

interface CameraWalk {
  cameraOffsets: number[];
  corrections: string[];
  drawnXs: number[];
  offsetOnceStopped: number;
}

// One tile per 100 ms step over FOLLOW_RATE, plus half a pixel of snapping.
const MAX_TRAIL = CAMERA_MAP.tilewidth + 0.5;

// seq 2 walks into a wall.
function walkWithCamera(): CameraWalk {
  const { context, corrections, frame, k } = startCameraWorld(
    (seq) => seq === 2,
  );

  const cameraOffsets: number[] = [];
  const drawnXs: number[] = [];
  context.pressKey("right");
  for (let step = 0; step < 30; step += 1) {
    const self = frame();
    const camera = k.getCamPos();
    cameraOffsets.push(Math.hypot(camera.x - self.x, camera.y - self.y));
    drawnXs.push(self.x);
  }
  context.releaseKey("right");
  let self = frame();
  for (let landing = 0; landing < 60; landing += 1) self = frame();
  const camera = k.getCamPos();

  return {
    cameraOffsets,
    corrections,
    drawnXs,
    offsetOnceStopped: Math.hypot(camera.x - self.x, camera.y - self.y),
  };
}

describe("camera trails the drawn self", () => {
  it("stays within a tile of every predicted, corrected and replayed frame", () => {
    const walk = walkWithCamera();

    expect(walk.corrections).toEqual(["blocked"]);
    expect(
      Math.max(...walk.drawnXs) - Math.min(...walk.drawnXs),
    ).toBeGreaterThan(16);
    expect(Math.max(...walk.cameraOffsets)).toBeGreaterThan(0);
    expect(Math.max(...walk.cameraOffsets)).toBeLessThanOrEqual(MAX_TRAIL);
  });

  it("lands exactly on you within a second of stopping", () => {
    expect(walkWithCamera().offsetOnceStopped).toBe(0);
  });
});

type CameraAction =
  | { kind: "key"; key: "+" | "-" }
  | { kind: "wheel"; deltaY: number; at: Tile }
  | { kind: "drag"; by: Tile }
  | { kind: "walk"; direction: Direction; frames: number }
  | { kind: "resize"; width: number; height: number };

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const CURSOR_SPOTS: Tile[] = [
  { x: 0, y: 0 },
  { x: 640, y: 480 },
  { x: 100, y: 400 },
];
const VIEWPORTS = [
  { width: 640, height: 480 },
  { width: 1280, height: 960 },
  { width: 320, height: 240 },
];

// A fixed seed keeps the script identical on every run.
function cameraScript(length: number): CameraAction[] {
  let seed = 7;
  const next = (bound: number) => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    // The low bits of this generator repeat quickly; scale the whole value.
    return Math.floor((seed / 2_147_483_648) * bound);
  };

  return Array.from({ length }, (): CameraAction => {
    switch (next(6)) {
      case 0:
        return { kind: "key", key: next(2) === 0 ? "+" : "-" };
      case 1:
        return {
          kind: "wheel",
          deltaY: next(2) === 0 ? -120 : 120,
          at: CURSOR_SPOTS[next(CURSOR_SPOTS.length)]!,
        };
      case 2:
        return {
          kind: "drag",
          by: { x: next(1601) - 800, y: next(1201) - 600 },
        };
      case 3:
        return { kind: "resize", ...VIEWPORTS[next(VIEWPORTS.length)]! };
      default:
        return {
          kind: "walk",
          direction: DIRECTIONS[next(DIRECTIONS.length)]!,
          frames: 1 + next(12),
        };
    }
  });
}

function dragCanvas(canvas: HTMLCanvasElement, by: Tile) {
  const pointer = { button: 0, pointerId: 1, pointerType: "mouse" };
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", { ...pointer, clientX: 0, clientY: 0 }),
  );
  canvas.dispatchEvent(
    new PointerEvent("pointermove", {
      ...pointer,
      clientX: by.x,
      clientY: by.y,
    }),
  );
  canvas.dispatchEvent(
    new PointerEvent("pointerup", { ...pointer, clientX: by.x, clientY: by.y }),
  );
}

interface CameraFrame {
  gapAtWalkStart: number;
  knownScale: boolean;
  level: ZoomLevel;
  offFollowed: number;
  onMap: boolean;
  settled: boolean;
  walked: boolean;
  walking: boolean;
  wholeMapShown: boolean;
}

// Whole map scales are fractions; allow for floating-point rounding.
const PIXEL_EPSILON = 1e-6;

// The visible rect fits inside the world, or is centred where it cannot.
// Snapping to screen pixels may move it by up to half a screen pixel.
function fitsMap(
  centre: number,
  visible: number,
  world: number,
  scale: number,
): boolean {
  const tolerance = 0.5 / scale + PIXEL_EPSILON;
  if (world <= visible + PIXEL_EPSILON) {
    return Math.abs(centre - world / 2) <= tolerance;
  }
  return (
    centre - visible / 2 >= -tolerance &&
    centre + visible / 2 <= world + tolerance
  );
}

// Long enough to land from the farthest drag. A still drawn frame is no
// sign of rest: a slow glide can hold one snapped pixel for a frame.
const SETTLE_FRAMES = Math.ceil(1500 / 16);

function playCameraScript(actions: CameraAction[]): CameraFrame[] {
  const { canvas, context, frame, k } = startCameraWorld(
    (_, target) => !isWalkable(CAMERA_LAYOUT, target),
  );
  const frames: CameraFrame[] = [];
  let walked = false;
  let gapAtWalkStart = 0;

  function check(walking: boolean, settled: boolean) {
    const self = frame();
    const camera = k.getCamPos();
    const scale = k.getCamScale().x;
    const viewport = { height: k.height(), width: k.width() };
    const visible = visibleArea(viewport, scale);
    const followed = clampCamera(self, visible, CAMERA_WORLD);
    const level = loadZoomLevel();
    frames.push({
      gapAtWalkStart,
      knownScale: scale === cameraScale(level, viewport, CAMERA_WORLD),
      level,
      offFollowed: Math.hypot(camera.x - followed.x, camera.y - followed.y),
      onMap:
        fitsMap(camera.x, visible.width, CAMERA_WORLD.width, scale) &&
        fitsMap(camera.y, visible.height, CAMERA_WORLD.height, scale),
      settled,
      walked,
      walking,
      wholeMapShown:
        level !== "whole" ||
        (visible.width >= CAMERA_WORLD.width - PIXEL_EPSILON &&
          visible.height >= CAMERA_WORLD.height - PIXEL_EPSILON),
    });
  }

  function settle() {
    for (let count = 1; count < SETTLE_FRAMES; count += 1) check(false, false);
    check(false, true);
  }

  for (const action of actions) {
    switch (action.kind) {
      case "key":
        context.pressKey(action.key);
        context.releaseKey(action.key);
        break;
      case "wheel":
        context.moveMouse(action.at);
        context.scroll(action.deltaY);
        break;
      case "drag":
        dragCanvas(canvas, action.by);
        walked = false;
        break;
      case "resize":
        context.resize(action.width, action.height);
        break;
      case "walk":
        gapAtWalkStart = frames.at(-1)?.offFollowed ?? 0;
        context.pressKey(action.direction);
        for (let step = 0; step < action.frames; step += 1) {
          check(true, false);
        }
        context.releaseKey(action.direction);
        walked = true;
        break;
    }
    if (action.kind === "wheel") walked = false;
    settle();
  }

  return frames;
}

describe("camera stays on the map at every zoom", () => {
  const frames = playCameraScript(cameraScript(200));

  const settled = frames.filter((frame) => frame.settled);

  it("covers every zoom level, walking, easing and the camera set free", () => {
    expect(new Set(frames.map(({ level }) => level))).toEqual(
      new Set(ZOOM_LEVELS),
    );
    expect(frames.filter(({ walking }) => walking).length).toBeGreaterThan(50);
    expect(frames.length - settled.length).toBeGreaterThan(1000);
  });

  it("never shows past the map's edge, even mid-zoom", () => {
    expect(frames.filter(({ onMap }) => !onMap)).toEqual([]);
  });

  it("lands on 1x, 2x and 3x at whole numbers and Whole map at its fit", () => {
    expect(settled.filter(({ knownScale }) => !knownScale)).toEqual([]);
  });

  it("shows the entire map once Whole map lands", () => {
    expect(settled.filter(({ wholeMapShown }) => !wholeMapShown)).toEqual([]);
  });

  it("trails you by at most a tile, or closes the gap a drag left", () => {
    expect(
      frames.filter(
        ({ gapAtWalkStart, offFollowed, walking }) =>
          walking && offFollowed > Math.max(MAX_TRAIL, gapAtWalkStart),
      ),
    ).toEqual([]);
  });

  it("lands exactly on you after every walk", () => {
    expect(
      settled.filter(({ offFollowed, walked }) => walked && offFollowed !== 0),
    ).toEqual([]);
  });
});

const FRAME_RATES = [30, 60, 90, 120, 144];
const VIEWPORT_HALF_WIDTH = 320;

// Frames at about 1000 / fps ms, up to 30% early or late, that add up to
// exactly totalMs so every rate ends at the same moment.
function jitteredFrames(fps: number, totalMs: number): number[] {
  let seed = fps;
  const count = Math.round((totalMs * fps) / 1000);
  const weights = Array.from({ length: count }, () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return 0.7 + 0.6 * (seed / 2_147_483_648);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => (weight / total) * totalMs);
}

function cameraRig({ reducedMotion = false } = {}) {
  window.localStorage.clear();
  const fake = fakeKaplay({ autoDraw: false });
  fake.kaplay({} as KAPLAYOpt);
  const context = fake.contexts[0]!;
  const canvas = document.createElement("canvas");
  canvas.setPointerCapture = vi.fn();
  const camera = createCampusCamera(context.k, {
    canvas,
    map: CAMERA_MAP,
    onZoomChanged: () => undefined,
    prefersReducedMotion: () => reducedMotion,
    start: tileCentre({ x: 30, y: 20 }, CAMERA_MAP),
  });
  return {
    camera,
    canvas,
    context,
    position: () => ({ ...context.k.getCamPos() }),
    scale: () => context.k.getCamScale().x,
  };
}

const YOU = { x: 30, y: 20 };
const YOU_DRAWN = tileCentre(YOU, CAMERA_MAP);

type Scenario = (rig: ReturnType<typeof cameraRig>) => void;

const zoomIn: Scenario = ({ context }) => context.pressKey("+");
const recentreAfterDrag: Scenario = ({ canvas }) =>
  dragCanvas(canvas, { x: 64, y: -48 });

function playCamera(
  scenario: Scenario,
  frames: number[],
  self?: Tile,
  options?: { reducedMotion?: boolean },
) {
  const rig = cameraRig(options);
  scenario(rig);
  const before = { position: rig.position(), scale: rig.scale() };
  const seen = frames.map((deltaMs) => {
    rig.camera.update({ deltaMs, self, walking: self !== undefined });
    return { position: rig.position(), scale: rig.scale() };
  });
  return { before, seen };
}

function zoomShare(from: number, seen: number, to: number): number {
  return Math.log(seen / from) / Math.log(to / from);
}

function recentreShare(from: Tile, seen: Tile): number {
  const gap = Math.hypot(YOU_DRAWN.x - from.x, YOU_DRAWN.y - from.y);
  return Math.hypot(seen.x - from.x, seen.y - from.y) / gap;
}

describe("camera eases every change at any frame rate", () => {
  it("does a quarter of a zoom or a recentre in the first 60 fps frame, at most", () => {
    const zoom = playCamera(zoomIn, [1000 / 60]);
    const recentre = playCamera(recentreAfterDrag, [1000 / 60], YOU);

    const zoomed = zoomShare(2, zoom.seen[0]!.scale, 3);
    const recentred = recentreShare(
      recentre.before.position,
      recentre.seen[0]!.position,
    );
    expect(zoomed).toBeGreaterThan(0);
    expect(zoomed).toBeLessThanOrEqual(0.25);
    expect(recentred).toBeGreaterThan(0);
    expect(recentred).toBeLessThanOrEqual(0.25);
  });

  it.each([100, 200, 300])(
    "reaches the same view after %i ms at every frame rate",
    (totalMs) => {
      const zooms = FRAME_RATES.map(
        (fps) =>
          playCamera(zoomIn, jitteredFrames(fps, totalMs)).seen.at(-1)!.scale,
      );
      const recentres = FRAME_RATES.map(
        (fps) =>
          playCamera(
            recentreAfterDrag,
            jitteredFrames(fps, totalMs),
            YOU,
          ).seen.at(-1)!.position,
      );

      const zoomSpreadPx =
        (Math.log(Math.max(...zooms)) - Math.log(Math.min(...zooms))) *
        VIEWPORT_HALF_WIDTH;
      const xs = recentres.map(({ x }) => x);
      const ys = recentres.map(({ y }) => y);
      // Drawn positions snap, so two rates may sit one screen pixel apart.
      const recentreSpreadPx =
        Math.max(
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys),
        ) * 2;
      expect(zoomSpreadPx).toBeLessThan(0.5);
      expect(recentreSpreadPx).toBeLessThanOrEqual(1);
    },
  );

  it.each(FRAME_RATES)(
    "holds the point under the cursor on every frame of a wheel zoom at %i fps",
    (fps) => {
      const cursor = { x: 480, y: 240 };
      const wheelZoom: Scenario = ({ context }) => {
        context.moveMouse(cursor);
        context.scroll(-100);
      };
      const { before, seen } = playCamera(wheelZoom, jitteredFrames(fps, 600));
      const offset = cursor.x - VIEWPORT_HALF_WIDTH;
      const underCursor = before.position.x + offset / before.scale;

      const driftPx = seen.map(
        ({ position, scale }) =>
          Math.abs(position.x + offset / scale - underCursor) * scale,
      );
      expect(Math.max(...driftPx)).toBeLessThanOrEqual(0.5 + PIXEL_EPSILON);
      expect(seen.at(-1)!.scale).toBe(3);
    },
  );

  it.each(FRAME_RATES)(
    "draws whole screen pixels and lands on you within a second at %i fps",
    (fps) => {
      const { seen } = playCamera(
        recentreAfterDrag,
        jitteredFrames(fps, 1000),
        YOU,
      );

      const offGrid = seen.filter(({ position, scale }) => {
        const offset = position.x * scale - VIEWPORT_HALF_WIDTH;
        return Math.abs(offset - Math.round(offset)) > PIXEL_EPSILON;
      });
      expect(offGrid).toEqual([]);
      expect(seen.at(-1)!.position).toEqual(YOU_DRAWN);
    },
  );

  it.each(FRAME_RATES)("lands a zoom within 600 ms at %i fps", (fps) => {
    expect(
      playCamera(zoomIn, jitteredFrames(fps, 600)).seen.at(-1)!.scale,
    ).toBe(3);
  });

  it("shows no in-between frames under reduced motion", () => {
    const zoom = playCamera(zoomIn, [16], undefined, { reducedMotion: true });
    const recentre = playCamera(recentreAfterDrag, [16], YOU, {
      reducedMotion: true,
    });

    expect(zoom.seen[0]!.scale).toBe(3);
    expect(recentre.seen[0]!.position).toEqual(YOU_DRAWN);
  });
});
