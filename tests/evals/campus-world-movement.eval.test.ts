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
  clampCamera,
  visibleArea,
  ZOOM_LEVELS,
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
      },
      {
        userId: "grace",
        ...drawnAt,
        facing: "down" as const,
        displayName: "Grace",
        spriteKey: null,
      },
    ],
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

describe("own-avatar input pacing", () => {
  it("holds one tile per stepMs and reports a refused move", () => {
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
          x: 0,
          y: 0,
          facing: "right" as const,
          displayName: "Ada",
          spriteKey: null,
        },
      ],
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

    controller.update({ deltaMs: 0, held: ["right"], pressed: "right" });
    controller.update({ deltaMs: 99, held: ["right"], pressed: null });
    expect(sent).toEqual([{ direction: "right", seq: 1 }]);

    controller.update({ deltaMs: 1, held: ["right"], pressed: null });
    expect(sent).toEqual([
      { direction: "right", seq: 1 },
      { direction: "right", seq: 2 },
    ]);

    const refused = readMoveResult({
      type: "moveResult",
      seq: 2,
      outcome: "too_fast",
      player: { userId: ADA, x: 1, y: 0, facing: "right" },
    });
    presence.getState().apply(refused);
    movement.apply(refused);

    expect(corrections).toEqual(["too_fast"]);
    expect(controller.readPlayer()).toEqual(refused.player);
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
      },
    ],
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
}

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

  return { cameraOffsets, corrections, drawnXs };
}

describe("camera stays on the drawn self", () => {
  it("follows every predicted, corrected and replayed frame with no offset", () => {
    const walk = walkWithCamera();

    expect(walk.corrections).toEqual(["blocked"]);
    expect(
      Math.max(...walk.drawnXs) - Math.min(...walk.drawnXs),
    ).toBeGreaterThan(16);
    expect(Math.max(...walk.cameraOffsets)).toBe(0);
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
  onMap: boolean;
  scale: number;
  walking: boolean;
  wrongWhileWalking: number;
}

// The visible rect fits inside the world, or is centred where it cannot.
function fitsMap(centre: number, visible: number, world: number): boolean {
  if (world <= visible) return centre === world / 2;
  return centre - visible / 2 >= 0 && centre + visible / 2 <= world;
}

function playCameraScript(actions: CameraAction[]): CameraFrame[] {
  const { canvas, context, frame, k } = startCameraWorld(
    (_, target) => !isWalkable(CAMERA_LAYOUT, target),
  );
  const frames: CameraFrame[] = [];

  function check(walking: boolean) {
    const self = frame();
    const camera = k.getCamPos();
    const scale = k.getCamScale().x;
    const visible = visibleArea(
      { height: k.height(), width: k.width() },
      scale,
    );
    const followed = clampCamera(self, visible, CAMERA_WORLD);
    frames.push({
      onMap:
        fitsMap(camera.x, visible.width, CAMERA_WORLD.width) &&
        fitsMap(camera.y, visible.height, CAMERA_WORLD.height),
      scale,
      walking,
      wrongWhileWalking: walking
        ? Math.hypot(camera.x - followed.x, camera.y - followed.y)
        : 0,
    });
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
        break;
      case "resize":
        context.resize(action.width, action.height);
        break;
      case "walk":
        context.pressKey(action.direction);
        for (let step = 0; step < action.frames; step += 1) check(true);
        context.releaseKey(action.direction);
        break;
    }
    check(false);
  }

  return frames;
}

describe("camera stays on the map at every zoom", () => {
  const frames = playCameraScript(cameraScript(200));

  it("covers every zoom level, walking and the camera set free", () => {
    expect(new Set(frames.map(({ scale }) => scale))).toEqual(
      new Set(ZOOM_LEVELS),
    );
    expect(frames.filter(({ walking }) => walking).length).toBeGreaterThan(50);
  });

  it("never shows past the map's edge", () => {
    expect(frames.filter(({ onMap }) => !onMap)).toEqual([]);
  });

  it("only ever draws at a whole-number zoom level", () => {
    expect(
      frames.filter(
        ({ scale }) => !(ZOOM_LEVELS as readonly number[]).includes(scale),
      ),
    ).toEqual([]);
  });

  it("returns to you on every frame you walk", () => {
    expect(
      Math.max(...frames.map(({ wrongWhileWalking }) => wrongWhileWalking)),
    ).toBe(0);
  });
});
