import type { Tile } from "campus-world-map";
import { describe, expect, it } from "vitest";

import {
  type Direction,
  type MoveResultMessage,
  parseServerMessage,
  type Player,
} from "@/core/realtime";
import {
  type PendingMove,
  reconcile,
} from "@/features/campus-world/services/movement/reconcile";
import {
  isWalkable,
  predictStep,
} from "@/features/campus-world/services/movement/step";
import { walkPath } from "@/features/campus-world/services/movement/walk-path";
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
}

const REMOTE_GAPS: RemoteGap[] = [
  {
    name: "a three-tile gap in one moved frame",
    drawnAt: { x: 0, y: 2 },
    moved: {
      type: "moved",
      players: [{ userId: "grace", x: 2, y: 3, facing: "down" }],
    },
  },
  {
    name: "a three-tile gap whose across-first route meets the wall",
    drawnAt: { x: 1, y: 1 },
    moved: {
      type: "moved",
      players: [{ userId: "grace", x: 3, y: 2, facing: "right" }],
    },
  },
];

function readMovedTile(frame: unknown): Tile {
  const result = parseServerMessage(JSON.stringify(frame));

  const player =
    result.ok && result.message.type === "moved"
      ? result.message.players[0]
      : undefined;

  if (!player) {
    throw new Error("the gap holds no moved frame with a player in it");
  }
  return { x: player.x, y: player.y };
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

describe("remote avatars walk a moved gap", () => {
  it.each(REMOTE_GAPS)("$name", ({ drawnAt, moved }) => {
    const target = readMovedTile(moved);
    const path = walkPath(drawnAt, target, movementLayout);

    expect(path).toHaveLength(3);
    expect(path.at(-1)).toEqual(target);
    expect(walksOneTileAtATime(drawnAt, path)).toBe(true);
    expect(path.every((tile) => isWalkable(movementLayout, tile))).toBe(true);
  });
});
