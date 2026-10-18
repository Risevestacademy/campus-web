// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  applyServerMessage,
  createPresenceStore,
  EMPTY_PRESENCE,
  type Presence,
} from "@/core/presence";
import type { Avatar, Direction, ServerMessage } from "@/core/realtime";

const MAP = { id: "campus", version: "v1", width: 60, height: 40 };
const PROTOTYPE_KEYS = [
  "__proto__",
  "constructor",
  "toString",
  "hasOwnProperty",
];

function avatar(
  userId: string,
  x = 1,
  displayName: string | null = userId,
): Avatar {
  return { userId, x, y: 1, facing: "down", displayName, spriteKey: null };
}

function applyAll(messages: ServerMessage[], from: Presence = EMPTY_PRESENCE) {
  return messages.reduce(applyServerMessage, from);
}

function snapshot(...players: Avatar[]): ServerMessage {
  return { type: "snapshot", map: MAP, players };
}

// Deterministic, so a failure replays exactly.
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

function randomHistory(random: () => number, length: number): ServerMessage[] {
  const ids = ["ada", "grace", "lin", ...PROTOTYPE_KEYS];
  const directions: Direction[] = ["up", "down", "left", "right"];
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]!;

  return Array.from({ length }, (): ServerMessage => {
    const userId = pick(ids);
    switch (pick(["joined", "left", "moved", "appearance"] as const)) {
      case "joined":
        return {
          type: "joined",
          player: avatar(userId, Math.floor(random() * 60)),
        };
      case "left":
        return { type: "left", userId };
      case "moved":
        return {
          type: "moved",
          players: [
            {
              userId,
              x: Math.floor(random() * 60),
              y: 2,
              facing: pick(directions),
            },
          ],
        };
      case "appearance":
        return {
          type: "appearance",
          userId,
          displayName: `renamed ${userId}`,
          spriteKey: null,
        };
    }
  });
}

describe("presence eval", () => {
  it("after a reconnect, shows exactly who the new snapshot lists", () => {
    const beforeDrop = applyAll([
      snapshot(avatar("ada"), avatar("grace")),
      { type: "joined", player: avatar("lin") },
    ]);

    const afterReconnect = applyAll([snapshot(avatar("ada", 9))], beforeDrop);

    expect([...afterReconnect.participants.keys()]).toEqual(["ada"]);
    expect([...afterReconnect.positions]).toEqual([
      ["ada", { x: 9, y: 1, facing: "down" }],
    ]);
  });

  it.each(Array.from({ length: 50 }, (_, seed) => seed))(
    "a snapshot erases any history before it (seed %i)",
    (seed) => {
      const history = randomHistory(seededRandom(seed + 1), 200);
      const listed = [avatar("grace", 3), avatar("constructor", 4)];

      const replayed = applyAll([...history, snapshot(...listed)]);
      const fresh = applyAll([snapshot(...listed)]);

      expect([...replayed.participants]).toEqual([...fresh.participants]);
      expect([...replayed.positions]).toEqual([...fresh.positions]);
    },
  );

  it("never holds anyone twice", () => {
    const presence = applyAll([
      snapshot(avatar("ada", 1), avatar("ada", 2)),
      { type: "joined", player: avatar("grace") },
      { type: "joined", player: avatar("grace", 5) },
    ]);

    expect([...presence.participants.keys()]).toEqual(["ada", "grace"]);
    expect(presence.positions.get("ada")?.x).toBe(2);
    expect(presence.positions.get("grace")?.x).toBe(5);
  });

  it.each(PROTOTYPE_KEYS)(
    "treats the id %j as a person, never as a property",
    (userId) => {
      const before = applyAll([snapshot(avatar("ada"))]);

      expect(
        applyAll(
          [{ type: "appearance", userId, displayName: "x", spriteKey: null }],
          before,
        ),
      ).toBe(before);
      expect(applyAll([{ type: "left", userId }], before)).toBe(before);
      expect(
        applyAll(
          [{ type: "moved", players: [{ userId, x: 1, y: 1, facing: "up" }] }],
          before,
        ),
      ).toBe(before);

      const joined = applyAll(
        [{ type: "joined", player: avatar(userId) }],
        before,
      );
      expect([...joined.participants.keys()]).toEqual(["ada", userId]);
      expect(Object.getPrototypeOf(joined.participants)).toBe(Map.prototype);
    },
  );

  it("moves nobody else on a moveResult naming them", () => {
    const before = applyAll([
      {
        type: "welcome",
        userId: "ada",
        connectionId: "c",
        heartbeatSeconds: 30,
        stepMs: 100,
        tickMs: 50,
        displayName: null,
        spriteKey: null,
      },
      snapshot(avatar("ada"), avatar("grace")),
    ]);

    const after = applyAll(
      [
        {
          type: "moveResult",
          seq: 1,
          outcome: "moved",
          player: { userId: "grace", x: 30, y: 30, facing: "up" },
        },
      ],
      before,
    );

    expect(after).toBe(before);
  });

  it("keeps only you while disconnected, so nobody lingers as a frozen stand-in", () => {
    const store = createPresenceStore();
    store.getState().apply({
      type: "welcome",
      userId: "ada",
      connectionId: "c",
      heartbeatSeconds: 30,
      stepMs: 100,
      tickMs: 50,
      displayName: null,
      spriteKey: null,
    });
    store.getState().apply(snapshot(avatar("ada", 4), avatar("grace")));

    store.getState().clearRemoteParticipants();

    expect([...store.getState().participants.keys()]).toEqual(["ada"]);
    expect([...store.getState().positions.keys()]).toEqual(["ada"]);
    expect(store.getState().map).toEqual(MAP);
  });
});
