// @vitest-environment node

import { describe, expect, it } from "vitest";

import type { Avatar, ServerMessage } from "@/core/realtime";

import {
  applyServerMessage,
  EMPTY_PRESENCE,
  type Presence,
  spaceNameOf,
  withoutRemoteParticipants,
} from "./presence";

const ADA: Avatar = {
  userId: "ada",
  x: 4,
  y: 7,
  facing: "down",
  displayName: "Ada",
  spriteKey: "placeholder-1",
  status: "available",
  spaceKey: "_default",
};
const GRACE: Avatar = {
  userId: "grace",
  x: 0,
  y: 0,
  facing: "right",
  displayName: null,
  spriteKey: null,
  status: "available",
  spaceKey: "_default",
};

const MAP = { id: "campus", version: "v1", width: 60, height: 40 };

function snapshotOf(...players: Avatar[]) {
  return applyServerMessage(EMPTY_PRESENCE, {
    type: "snapshot",
    map: MAP,
    players,
    spaces: [],
  });
}

function afterNearby(presence: Presence, ...userIds: string[]) {
  return applyServerMessage(presence, { type: "nearby", userIds });
}

describe("applyServerMessage", () => {
  it("rebuilds who is here and where from a snapshot, dropping anyone it omits", () => {
    const before = snapshotOf(ADA, GRACE);

    const presence = applyServerMessage(before, {
      type: "snapshot",
      map: { id: "campus", version: "v1", width: 60, height: 40 },
      players: [{ ...ADA, x: 9 }],
      spaces: [],
    });

    expect([...presence.participants]).toEqual([
      [
        "ada",
        {
          userId: "ada",
          displayName: "Ada",
          spriteKey: "placeholder-1",
          status: "available",
          spaceKey: "_default",
        },
      ],
    ]);
    expect([...presence.positions]).toEqual([
      ["ada", { x: 9, y: 7, facing: "down" }],
    ]);
    expect(presence.map).toEqual({
      id: "campus",
      version: "v1",
      width: 60,
      height: 40,
    });
  });

  it("clamps every authoritative position to the snapshot map", () => {
    const presence = applyServerMessage(EMPTY_PRESENCE, {
      type: "snapshot",
      map: { id: "campus", version: "v1", width: 3, height: 2 },
      players: [{ ...ADA, x: 99, y: 99 }],
      spaces: [],
    });

    expect(presence.positions.get("ada")).toEqual({
      x: 2,
      y: 1,
      facing: "down",
    });
  });

  it("names you from welcome", () => {
    const presence = applyServerMessage(EMPTY_PRESENCE, {
      type: "welcome",
      userId: "ada",
      connectionId: "connection-1",
      heartbeatSeconds: 30,
      stepMs: 100,
      tickMs: 50,
      displayName: "Ada",
      spriteKey: null,
    });

    expect(presence.selfId).toBe("ada");
  });

  it("adds whoever joined, replacing an entry already held for them", () => {
    const presence = applyServerMessage(snapshotOf(ADA, GRACE), {
      type: "joined",
      player: { ...GRACE, x: 5, displayName: "Grace" },
    });

    expect(presence.participants.size).toBe(2);
    expect(presence.participants.get("grace")?.displayName).toBe("Grace");
    expect(presence.positions.get("grace")).toEqual({
      x: 5,
      y: 0,
      facing: "right",
    });
  });

  it("removes whoever left, from who and where", () => {
    const presence = applyServerMessage(snapshotOf(ADA, GRACE), {
      type: "left",
      userId: "grace",
    });

    expect([...presence.participants.keys()]).toEqual(["ada"]);
    expect([...presence.positions.keys()]).toEqual(["ada"]);
  });

  it("redraws a known person with their new appearance", () => {
    const presence = applyServerMessage(snapshotOf(ADA, GRACE), {
      type: "appearance",
      userId: "grace",
      displayName: "Grace",
      spriteKey: "placeholder-2",
    });

    expect(presence.participants.get("grace")).toEqual({
      userId: "grace",
      displayName: "Grace",
      spriteKey: "placeholder-2",
      status: "available",
      spaceKey: "_default",
    });
  });

  it("keeps a person's status and room through a new appearance", () => {
    const before = applyServerMessage(snapshotOf(ADA), {
      type: "statusChanged",
      userId: "ada",
      status: "busy",
    });

    const presence = applyServerMessage(before, {
      type: "appearance",
      userId: "ada",
      displayName: "Ada L.",
      spriteKey: null,
    });

    expect(presence.participants.get("ada")).toMatchObject({
      displayName: "Ada L.",
      status: "busy",
      spaceKey: "_default",
    });
  });

  it("changes a known person's status, leaving where they stand alone", () => {
    const before = snapshotOf(ADA, GRACE);

    const presence = applyServerMessage(before, {
      type: "statusChanged",
      userId: "grace",
      status: "away",
    });

    expect(presence.participants.get("grace")?.status).toBe("away");
    expect(presence.participants.get("ada")).toBe(
      before.participants.get("ada"),
    );
    expect(presence.positions).toBe(before.positions);
  });

  it("moves a known person into the space they stepped into", () => {
    const presence = applyServerMessage(snapshotOf(ADA), {
      type: "spaceChanged",
      userId: "ada",
      spaceKey: "library",
    });

    expect(presence.participants.get("ada")?.spaceKey).toBe("library");
  });

  it.each<ServerMessage>([
    { type: "statusChanged", userId: "stranger", status: "busy" },
    { type: "spaceChanged", userId: "stranger", spaceKey: "library" },
  ])("ignores a $type for somebody who is not here", (message) => {
    const before = snapshotOf(ADA);

    expect(applyServerMessage(before, message)).toBe(before);
  });

  it("moves everyone listed that it knows, leaving who is here alone", () => {
    const before = snapshotOf(ADA, GRACE);

    const presence = applyServerMessage(before, {
      type: "moved",
      players: [
        { userId: "grace", x: 1, y: 0, facing: "right" },
        { userId: "stranger", x: 2, y: 2, facing: "up" },
      ],
    });

    expect(presence.participants).toBe(before.participants);
    expect([...presence.positions]).toEqual([
      ["ada", { x: 4, y: 7, facing: "down" }],
      ["grace", { x: 1, y: 0, facing: "right" }],
    ]);
  });

  it("puts you where world's moveResult says", () => {
    const withSelf = applyServerMessage(snapshotOf(ADA), {
      type: "welcome",
      userId: "ada",
      connectionId: "connection-1",
      heartbeatSeconds: 30,
      stepMs: 100,
      tickMs: 50,
      displayName: "Ada",
      spriteKey: null,
    });

    const presence = applyServerMessage(withSelf, {
      type: "moveResult",
      seq: 3,
      outcome: "blocked",
      player: { userId: "ada", x: 4, y: 7, facing: "up" },
    });

    expect(presence.positions.get("ada")).toEqual({ x: 4, y: 7, facing: "up" });
  });

  it.each<ServerMessage>([
    { type: "pong" },
    { type: "replaced" },
    { type: "error", code: "BAD_MESSAGE", message: "Unknown type." },
    {
      type: "appearance",
      userId: "stranger",
      displayName: "X",
      spriteKey: null,
    },
    { type: "left", userId: "stranger" },
    {
      type: "moved",
      players: [{ userId: "stranger", x: 1, y: 1, facing: "up" }],
    },
    {
      type: "moveResult",
      seq: 1,
      outcome: "moved",
      player: { userId: "ada", x: 5, y: 7, facing: "right" },
    },
    { type: "nearby", userIds: [] },
  ])(
    "returns the same presence for $type that changes nobody it knows",
    (message) => {
      const before = snapshotOf(ADA, GRACE);

      expect(applyServerMessage(before, message)).toBe(before);
    },
  );
});

describe("nearby", () => {
  it("keeps whoever came near in arrival order, not world's sorted order", () => {
    const presence = afterNearby(
      afterNearby(snapshotOf(ADA, GRACE), "grace"),
      "ada",
      "grace",
    );

    expect(presence.nearby).toEqual(["grace", "ada"]);
  });

  it("drops whoever walked away and keeps the rest in place", () => {
    const presence = afterNearby(
      afterNearby(afterNearby(snapshotOf(ADA, GRACE), "grace"), "ada", "grace"),
      "ada",
    );

    expect(presence.nearby).toEqual(["ada"]);
  });

  it("holds somebody a frame names twice only once", () => {
    const presence = afterNearby(
      afterNearby(snapshotOf(ADA, GRACE), "grace"),
      "ada",
      "ada",
      "grace",
      "grace",
    );

    expect(presence.nearby).toEqual(["grace", "ada"]);
  });

  it("returns the same presence when world resends the same people in another order", () => {
    const before = afterNearby(snapshotOf(ADA, GRACE), "ada", "grace");

    expect(afterNearby(before, "grace", "ada")).toBe(before);
  });

  it("counts an encounter only when somebody comes near after nobody was", () => {
    const firstEncounter = afterNearby(
      afterNearby(snapshotOf(ADA, GRACE), "grace"),
      "ada",
      "grace",
    );
    const aloneAgain = afterNearby(firstEncounter);
    const secondEncounter = afterNearby(aloneAgain, "ada");

    expect(
      [firstEncounter, aloneAgain, secondEncounter].map(
        ({ encounter }) => encounter,
      ),
    ).toEqual([1, 1, 2]);
  });

  it("forgets who is near on a snapshot or a closed socket, keeping the encounter count", () => {
    const near = afterNearby(
      applyServerMessage(snapshotOf(ADA, GRACE), {
        type: "welcome",
        userId: "ada",
        connectionId: "connection-1",
        heartbeatSeconds: 30,
        stepMs: 100,
        tickMs: 50,
        displayName: "Ada",
        spriteKey: null,
      }),
      "grace",
    );

    const reconnected = applyServerMessage(near, {
      type: "snapshot",
      map: MAP,
      players: [ADA, GRACE],
      spaces: [],
    });
    const closed = withoutRemoteParticipants(near);

    expect([reconnected.nearby, reconnected.encounter]).toEqual([[], 1]);
    expect([closed.nearby, closed.encounter]).toEqual([[], 1]);
  });

  it("is synced from a snapshot until the socket closes, and keeps the map meanwhile", () => {
    const joined = snapshotOf(ADA, GRACE);
    const closed = withoutRemoteParticipants(joined);

    expect(EMPTY_PRESENCE.synced).toBe(false);
    expect(joined.synced).toBe(true);
    expect(closed.synced).toBe(false);
    expect(closed.map).toEqual(MAP);
    expect(
      applyServerMessage(closed, {
        type: "snapshot",
        map: MAP,
        players: [ADA],
        spaces: [],
      }).synced,
    ).toBe(true);
  });
});

describe("space names", () => {
  function namedSnapshot(...spaces: { spaceKey: string; name: string }[]) {
    return applyServerMessage(EMPTY_PRESENCE, {
      type: "snapshot",
      map: MAP,
      players: [ADA],
      spaces,
    });
  }

  it("names each space from the snapshot", () => {
    const presence = namedSnapshot({ spaceKey: "library", name: "Library" });

    expect(spaceNameOf(presence, "library")).toBe("Library");
  });

  it("replaces every name on a spaces frame, dropping any it omits", () => {
    const presence = applyServerMessage(
      namedSnapshot(
        { spaceKey: "library", name: "Library" },
        { spaceKey: "pod-1", name: "Pod One" },
      ),
      {
        type: "spaces",
        spaces: [{ spaceKey: "library", name: "Reading Room" }],
      },
    );

    expect([
      spaceNameOf(presence, "library"),
      spaceNameOf(presence, "pod-1"),
    ]).toEqual(["Reading Room", "pod-1"]);
  });

  it("shows the key for a space world has not named", () => {
    expect(spaceNameOf(EMPTY_PRESENCE, "pod-9")).toBe("pod-9");
  });
});
