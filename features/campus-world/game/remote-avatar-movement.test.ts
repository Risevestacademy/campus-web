import type { MapLayout } from "campus-world-map";
import { describe, expect, it } from "vitest";

import { createPresenceStore } from "@/core/presence";
import {
  type Avatar,
  createWorldMovementChannel,
  type ServerMessage,
} from "@/core/realtime";

import { movementLayout } from "../testing/movement";
import { createRemoteAvatarMovement } from "./remote-avatar-movement";

const ADA: Avatar = {
  userId: "ada",
  x: 0,
  y: 0,
  facing: "down",
  displayName: "Ada",
  spriteKey: null,
  status: "available",
  spaceKey: "_default",
};

const GRACE: Avatar = {
  userId: "grace",
  x: 0,
  y: 2,
  facing: "down",
  displayName: "Grace",
  spriteKey: null,
  status: "available",
  spaceKey: "_default",
};

function startMovement(
  remote: Avatar = GRACE,
  reducedMotion: boolean | (() => boolean) = false,
  layout: MapLayout = movementLayout,
) {
  const presence = createPresenceStore();
  const movement = createWorldMovementChannel();
  const welcome = {
    type: "welcome" as const,
    userId: ADA.userId,
    connectionId: "connection-1",
    heartbeatSeconds: 30,
    stepMs: 100,
    tickMs: 50,
    displayName: ADA.displayName,
    spriteKey: ADA.spriteKey,
  };
  const snapshot = {
    type: "snapshot" as const,
    map: { id: "campus", version: "v1", width: 5, height: 4 },
    players: [ADA, remote],
  };
  presence.getState().apply(welcome);
  presence.getState().apply(snapshot);
  movement.apply(welcome);
  movement.apply(snapshot);

  const controller = createRemoteAvatarMovement({
    layout,
    movement,
    prefersReducedMotion: () =>
      typeof reducedMotion === "function" ? reducedMotion() : reducedMotion,
    readPresence: presence.getState,
  });

  function receive(message: ServerMessage) {
    presence.getState().apply(message);
    movement.apply(message);
  }

  return { controller, movement, presence, receive, snapshot };
}

describe("createRemoteAvatarMovement", () => {
  it("interpolates the displayed position within a step", () => {
    const { controller, receive } = startMovement();
    receive({
      type: "moved",
      players: [{ userId: "grace", x: 1, y: 2, facing: "right" }],
    });

    controller.update(50);

    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 0.5,
      y: 2,
      facing: "right",
    });
  });

  it("walks a moved gap one orthogonal tile per stepMs", () => {
    const { controller, receive } = startMovement();
    receive({
      type: "moved",
      players: [{ userId: "grace", x: 2, y: 3, facing: "left" }],
    });

    controller.update(100);
    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 1,
      y: 2,
      facing: "right",
    });

    controller.update(100);
    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 2,
      y: 2,
      facing: "down",
    });

    controller.update(100);
    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 2,
      y: 3,
      facing: "left",
    });
  });

  it("uses excess frame time across queued steps", () => {
    const { controller, receive } = startMovement();
    receive({
      type: "moved",
      players: [{ userId: "grace", x: 2, y: 3, facing: "down" }],
    });

    controller.update(250);

    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 2,
      y: 2.5,
      facing: "down",
    });
  });

  it("does not bank excess frame time after reaching the target", () => {
    const { controller, receive } = startMovement();
    receive({
      type: "moved",
      players: [{ userId: "grace", x: 1, y: 2, facing: "right" }],
    });
    controller.update(250);

    receive({
      type: "moved",
      players: [{ userId: "grace", x: 2, y: 2, facing: "right" }],
    });
    controller.update(0);

    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 1,
      y: 2,
      facing: "right",
    });
  });

  it("snaps when a new frame would exceed four queued steps", () => {
    const { controller, receive } = startMovement({ ...GRACE, y: 3 });
    for (const [x, facing] of [
      [1, "right"],
      [2, "right"],
      [3, "right"],
      [4, "right"],
      [3, "left"],
    ] as const) {
      receive({
        type: "moved",
        players: [{ userId: "grace", x, y: 3, facing }],
      });
    }

    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 3,
      y: 3,
      facing: "left",
    });
  });

  it("snaps movement when reduced motion is preferred", () => {
    const { controller, receive } = startMovement(GRACE, true);
    receive({
      type: "moved",
      players: [{ userId: "grace", x: 2, y: 3, facing: "left" }],
    });

    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 2,
      y: 3,
      facing: "left",
    });
  });

  it("stops an active walk when reduced motion becomes preferred", () => {
    let reducedMotion = false;
    const { controller, receive } = startMovement(GRACE, () => reducedMotion);
    receive({
      type: "moved",
      players: [{ userId: "grace", x: 2, y: 3, facing: "left" }],
    });
    controller.update(50);

    reducedMotion = true;
    controller.update(0);

    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 2,
      y: 3,
      facing: "left",
    });
  });

  it("applies a turn-only frame immediately", () => {
    const { controller, receive } = startMovement();

    receive({
      type: "moved",
      players: [{ userId: "grace", x: 0, y: 2, facing: "up" }],
    });

    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 0,
      y: 2,
      facing: "up",
    });
  });

  it("replaces active movement with a reconnect snapshot", () => {
    const { controller, receive, snapshot } = startMovement();
    receive({
      type: "moved",
      players: [{ userId: "grace", x: 2, y: 3, facing: "left" }],
    });
    controller.update(50);

    receive({
      ...snapshot,
      players: [ADA, { ...GRACE, x: 4, y: 3, facing: "up" }],
    });

    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 4,
      y: 3,
      facing: "up",
    });
  });

  it("adds a joined remote at its authoritative position", () => {
    const { controller, receive } = startMovement();

    receive({
      type: "joined",
      player: {
        userId: "linus",
        x: 4,
        y: 3,
        facing: "up",
        displayName: "Linus",
        spriteKey: null,
        status: "available",
        spaceKey: "_default",
      },
    });

    expect(controller.readPlayers().get("linus")).toEqual({
      userId: "linus",
      x: 4,
      y: 3,
      facing: "up",
    });
  });

  it("removes a departed remote and its queued movement", () => {
    const { controller, receive } = startMovement();
    receive({
      type: "moved",
      players: [{ userId: "grace", x: 2, y: 3, facing: "left" }],
    });

    receive({ type: "left", userId: "grace" });
    controller.update(300);

    expect(controller.readPlayers().has("grace")).toBe(false);
  });

  it("snaps instead of walking through a wall when neither L-route is safe", () => {
    const closedCorner: MapLayout = {
      ...movementLayout,
      collisions: [
        { shape: "rect", x: 1, y: 0, width: 1, height: 1 },
        { shape: "rect", x: 0, y: 1, width: 1, height: 1 },
      ],
    };
    const { controller, receive } = startMovement(
      { ...GRACE, x: 0, y: 0 },
      false,
      closedCorner,
    );

    receive({
      type: "moved",
      players: [{ userId: "grace", x: 2, y: 2, facing: "down" }],
    });

    expect(controller.readPlayers().get("grace")).toEqual({
      userId: "grace",
      x: 2,
      y: 2,
      facing: "down",
    });
  });
});
