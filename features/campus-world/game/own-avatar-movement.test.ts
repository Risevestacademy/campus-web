import { describe, expect, it, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import {
  createWorldMovementChannel,
  type Direction,
  type MoveResultMessage,
  type PositionCorrectedMessage,
  type WalkEndedMessage,
  type WalkingMessage,
} from "@/core/realtime";

import { movementLayout } from "../testing/movement";
import { createOwnAvatarMovement } from "./own-avatar-movement";

const ADA = {
  userId: "ada",
  x: 0,
  y: 0,
  facing: "down" as const,
  displayName: "Ada",
  spriteKey: null,
  status: "available" as const,
  spaceKey: "_default",
};

function startMovement(
  reducedMotion = false,
  sendMove: (direction: Direction, seq: number) => boolean = () => true,
) {
  const presence = createPresenceStore();
  const movement = createWorldMovementChannel();
  const sent: Array<{ direction: Direction; seq: number }> = [];
  movement.bind((message) => {
    if (message.type !== "move") return true;
    if (!sendMove(message.direction, message.seq)) return false;
    sent.push({ direction: message.direction, seq: message.seq });
    return true;
  });
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
    players: [ADA],
    spaces: [],
  };
  presence.getState().apply(welcome);
  presence.getState().apply(snapshot);
  movement.apply(welcome);
  movement.apply(snapshot);
  const onMoveCorrected = vi.fn();
  const controller = createOwnAvatarMovement({
    layout: movementLayout,
    movement,
    onMoveCorrected,
    prefersReducedMotion: () => reducedMotion,
    readPresence: presence.getState,
  });

  function update(
    deltaMs: number,
    pressed: Direction | null = null,
    held: readonly Direction[] = [],
  ) {
    controller.update({ deltaMs, held, pressed });
  }

  function receive(
    result:
      | MoveResultMessage
      | WalkingMessage
      | WalkEndedMessage
      | PositionCorrectedMessage,
  ) {
    presence.getState().apply(result);
    movement.apply(result);
  }

  return {
    controller,
    movement,
    onMoveCorrected,
    presence,
    receive,
    sent,
    snapshot,
    update,
  };
}

describe("createOwnAvatarMovement", () => {
  it("predicts at once and sends held movement once per step", () => {
    const { controller, sent, update } = startMovement();

    update(0, "right", ["right"]);
    expect(sent).toEqual([{ direction: "right", seq: 1 }]);
    expect(controller.readPlayer()).toEqual({
      userId: "ada",
      x: 0,
      y: 0,
      facing: "right",
    });

    update(50, null, ["right"]);
    expect(controller.readPlayer()?.x).toBe(0.5);
    expect(sent).toHaveLength(1);

    update(49, null, ["right"]);
    expect(sent).toHaveLength(1);

    update(1, null, ["right"]);
    expect(sent).toEqual([
      { direction: "right", seq: 1 },
      { direction: "right", seq: 2 },
    ]);
  });

  it("buffers the latest direction pressed during a step", () => {
    const { sent, update } = startMovement();

    update(0, "right", ["right"]);
    update(40, "down", ["right", "down"]);
    update(60, null, ["right", "down"]);

    expect(sent).toEqual([
      { direction: "right", seq: 1 },
      { direction: "down", seq: 2 },
    ]);
  });

  it("keeps held walking at stepMs when frames overrun a step", () => {
    let nowMs = 0;
    const sentAtMs: number[] = [];
    const { update } = startMovement(false, () => {
      sentAtMs.push(nowMs);
      return true;
    });

    update(0, "right", ["right"]);
    while (nowMs < 600) {
      nowMs += 30;
      update(30, null, ["right"]);
    }

    expect(sentAtMs).toEqual([0, 120, 210, 300, 420, 510, 600]);
  });

  it("sends only one next step after a stalled frame", () => {
    const { sent, update } = startMovement();

    update(0, "right", ["right"]);
    update(250, null, ["right"]);
    update(16, null, ["right"]);

    expect(sent).toEqual([
      { direction: "right", seq: 1 },
      { direction: "right", seq: 2 },
    ]);
  });

  it("does not predict or consume a sequence when sending fails", () => {
    const { controller, sent, update } = startMovement(false, () => false);

    update(0, "right");

    expect(sent).toEqual([]);
    expect(controller.readPlayer()).toEqual({
      userId: "ada",
      x: 0,
      y: 0,
      facing: "down",
    });
  });

  it("reconciles a too_fast move and reports only the non-moved outcome", () => {
    const { controller, onMoveCorrected, receive, update } = startMovement();
    update(0, "right");

    receive({
      type: "moveResult",
      seq: 1,
      outcome: "too_fast",
      player: { userId: "ada", x: 0, y: 0, facing: "down" },
    });

    expect(controller.readPlayer()).toEqual({
      userId: "ada",
      x: 0,
      y: 0,
      facing: "down",
    });
    expect(onMoveCorrected).toHaveBeenCalledExactlyOnceWith("too_fast");
  });

  it("reports no correction while held against the edge it predicted", () => {
    const { controller, onMoveCorrected, receive, sent, update } =
      startMovement();
    update(0, "up", ["up"]);
    for (let frame = 0; frame < 4; frame += 1) update(100, null, ["up"]);

    for (const { seq } of sent) {
      receive({
        type: "moveResult",
        seq,
        outcome: "blocked",
        player: { userId: "ada", x: 0, y: 0, facing: "up" },
      });
    }

    expect(sent).toHaveLength(5);
    expect(onMoveCorrected).not.toHaveBeenCalled();
    expect(controller.readPlayer()).toEqual({
      userId: "ada",
      x: 0,
      y: 0,
      facing: "up",
    });
  });

  it("reports a refused step once and stops stepping into it while held", () => {
    const { controller, onMoveCorrected, receive, sent, update } =
      startMovement();
    const facingRefused = {
      userId: "ada",
      x: 0,
      y: 0,
      facing: "right" as const,
    };
    update(0, "right", ["right"]);

    for (let frame = 0; frame < 4; frame += 1) {
      receive({
        type: "moveResult",
        seq: sent.length,
        outcome: "refused",
        player: facingRefused,
      });
      update(100, null, ["right"]);
      expect(controller.readPlayer()).toEqual(facingRefused);
    }

    expect(sent).toHaveLength(5);
    expect(onMoveCorrected).toHaveBeenCalledExactlyOnceWith("refused");
  });

  it("walks into a refused tile again once world lets them in", () => {
    const { controller, onMoveCorrected, receive, sent, update } =
      startMovement();
    update(0, "right", ["right"]);
    receive({
      type: "moveResult",
      seq: 1,
      outcome: "refused",
      player: { userId: "ada", x: 0, y: 0, facing: "right" },
    });
    update(100, null, ["right"]);

    receive({
      type: "moveResult",
      seq: 2,
      outcome: "moved",
      player: { userId: "ada", x: 1, y: 0, facing: "right" },
    });
    update(100, null, ["right"]);
    update(50, null, ["right"]);

    expect(sent).toHaveLength(3);
    expect(controller.readPlayer()?.x).toBe(1.5);
    expect(onMoveCorrected).toHaveBeenCalledExactlyOnceWith("refused");
  });

  it("keeps a correct moved animation and emits no correction", () => {
    const { controller, onMoveCorrected, receive, update } = startMovement();
    update(0, "right");
    update(40);

    receive({
      type: "moveResult",
      seq: 1,
      outcome: "moved",
      player: { userId: "ada", x: 1, y: 0, facing: "right" },
    });

    expect(controller.readPlayer()?.x).toBe(0.4);
    expect(onMoveCorrected).not.toHaveBeenCalled();
  });

  it("drops old pending moves and takes a reconnect snapshot", () => {
    const { controller, movement, presence, sent, snapshot, update } =
      startMovement();
    update(0, "right");
    movement.disconnect();
    const resumed = {
      ...snapshot,
      players: [{ ...ADA, x: 3, y: 2, facing: "left" as const }],
    };
    const welcome = {
      type: "welcome" as const,
      userId: ADA.userId,
      connectionId: "connection-2",
      heartbeatSeconds: 30,
      stepMs: 100,
      tickMs: 50,
      displayName: ADA.displayName,
      spriteKey: ADA.spriteKey,
    };
    presence.getState().apply(welcome);
    presence.getState().apply(resumed);
    movement.apply(welcome);
    movement.apply(resumed);

    expect(controller.readPlayer()).toEqual({
      userId: "ada",
      x: 3,
      y: 2,
      facing: "left",
    });

    update(0, "up");
    expect(sent.at(-1)).toEqual({ direction: "up", seq: 2 });
  });

  it("jumps under reduced motion but keeps network pacing", () => {
    const { controller, sent, update } = startMovement(true);

    update(0, "right", ["right"]);
    expect(controller.readPlayer()?.x).toBe(1);

    update(99, null, ["right"]);
    expect(sent).toHaveLength(1);
    update(1, null, ["right"]);
    expect(sent).toHaveLength(2);
  });

  describe("a walk world takes", () => {
    const step = (x: number, y = 0): WalkingMessage => ({
      type: "walking",
      player: { userId: "ada", x, y, facing: "right" },
    });
    const ended = (
      x: number,
      reason: WalkEndedMessage["reason"] = "arrived",
    ): WalkEndedMessage => ({
      type: "walkEnded",
      reason,
      player: { userId: "ada", x, y: 0, facing: "right" },
      spaceKey: null,
    });

    it("draws each step over stepMs and sends nothing", () => {
      const { controller, receive, sent, update } = startMovement();

      receive(step(1));
      update(50);
      expect(controller.readPlayer()?.x).toBe(0.5);

      update(50);
      expect(controller.readPlayer()?.x).toBe(1);
      expect(sent).toEqual([]);
    });

    it("jumps each step under reduced motion", () => {
      const { controller, receive } = startMovement(true);

      receive(step(1));

      expect(controller.readPlayer()?.x).toBe(1);
    });

    it("catches up batched steps without cutting through the wall at (2, 1)", () => {
      const { controller, receive, sent, update } = startMovement();

      receive(step(1));
      receive(step(2));
      receive(step(3));
      receive(step(3, 1));

      expect(controller.readPlayer()).toMatchObject({ x: 3, y: 0 });
      update(75);
      expect(controller.readPlayer()).toMatchObject({ x: 3, y: 0.75 });
      update(25);
      expect(controller.readPlayer()).toMatchObject({ x: 3, y: 1 });
      expect(sent).toEqual([]);
    });

    it("finishes an early step at its tile before animating a turn", () => {
      const { controller, receive, update } = startMovement();

      receive(step(1));
      update(50);
      receive(step(1, 1));

      expect(controller.readPlayer()).toMatchObject({ x: 1, y: 0 });
      update(50);
      expect(controller.readPlayer()).toMatchObject({ x: 1, y: 0.5 });
    });

    it("starts a manual turn from the last world tile when cancelling mid-step", () => {
      const { controller, receive, sent, update } = startMovement();

      receive(step(1));
      update(50);
      update(0, "down");

      expect(controller.readPlayer()).toMatchObject({ x: 1, y: 0 });
      update(50);
      expect(controller.readPlayer()).toMatchObject({ x: 1, y: 0.5 });
      expect(sent).toEqual([{ direction: "down", seq: 1 }]);
    });

    it("lets a key press end the walk mid-step, even with steps back to back", () => {
      const { receive, sent, update } = startMovement();

      receive(step(1));
      update(90);
      receive(step(2));
      update(10, "down", ["down"]);

      expect(sent).toEqual([{ direction: "down", seq: 1 }]);
    });

    it("trusts the moveResult over steps still on their way after a key press", () => {
      const { controller, receive, update } = startMovement();

      update(0, "down", ["down"]);
      receive(step(1));
      receive(ended(1, "stopped"));
      expect(controller.readPlayer()?.x).toBe(0);

      receive({
        type: "moveResult",
        seq: 1,
        outcome: "moved",
        player: { userId: "ada", x: 1, y: 1, facing: "down" },
      });

      expect(controller.readPlayer()).toMatchObject({ x: 1, y: 1 });
    });

    it("finishes the last step when the walk ends on that tile", () => {
      const { controller, receive, update } = startMovement();

      receive(step(1));
      update(50);
      receive(ended(1));
      expect(controller.readPlayer()?.x).toBe(0.5);

      update(50);
      expect(controller.readPlayer()?.x).toBe(1);
    });

    it("snaps to a nonadjacent end position without animating through intervening tiles", () => {
      const { controller, receive } = startMovement();

      receive(step(1));
      receive(ended(3, "moved_by_staff"));

      expect(controller.readPlayer()?.x).toBe(3);
    });

    it("reports each walk's start once", () => {
      const { controller, receive } = startMovement();

      expect(controller.takeWalkStarted()).toBe(false);

      receive(step(1));
      expect(controller.takeWalkStarted()).toBe(true);

      receive(step(2));
      expect(controller.takeWalkStarted()).toBe(false);

      receive(ended(2));
      receive(step(3));
      expect(controller.takeWalkStarted()).toBe(true);
    });
  });

  describe("world moving the avatar out of a wall", () => {
    const corrected = (x: number, y = 0): PositionCorrectedMessage => ({
      type: "positionCorrected",
      player: { userId: "ada", x, y, facing: "down" },
    });

    it("snaps to the tile world chose, with no animation", () => {
      const { controller, receive } = startMovement();

      receive(corrected(3, 2));

      expect(controller.readPlayer()).toEqual({
        userId: "ada",
        x: 3,
        y: 2,
        facing: "down",
      });
    });

    it("drops the steps predicted from the old tile, and the animation", () => {
      const { controller, receive, sent, update } = startMovement();
      update(0, "right", ["right"]);
      update(20, null, []);
      expect(sent).toHaveLength(1);

      receive(corrected(3, 2));
      update(50, null, []);

      expect(controller.readPlayer()).toEqual({
        userId: "ada",
        x: 3,
        y: 2,
        facing: "down",
      });
    });

    it("steps on from the new tile, with the next sequence number", () => {
      const { controller, receive, sent, update } = startMovement();
      update(0, "right", ["right"]);
      receive(corrected(3, 2));

      update(200, "right", ["right"]);

      expect(sent.at(-1)).toEqual({ direction: "right", seq: 2 });
      expect(controller.readPlayer()?.y).toBe(2);
    });

    it("forgets tiles learned as refused on the old map", () => {
      const { controller, receive, update } = startMovement();
      update(0, "right", ["right"]);
      receive({
        type: "moveResult",
        seq: 1,
        outcome: "refused",
        player: { userId: "ada", x: 0, y: 0, facing: "right" },
      });
      update(100, null, ["right"]);
      expect(controller.readPlayer()?.x).toBe(0);

      receive(corrected(0, 0));
      update(0, null, ["right"]);
      update(50, null, ["right"]);

      expect(controller.readPlayer()?.x).toBeGreaterThan(0);
    });

    it("tells the camera to come back to the avatar, once", () => {
      const { controller, receive } = startMovement();
      expect(controller.takeWalkStarted()).toBe(false);

      receive(corrected(3, 2));

      expect(controller.takeWalkStarted()).toBe(true);
      expect(controller.takeWalkStarted()).toBe(false);
    });

    it("moves the avatar in presence too, so the roster and the map agree", () => {
      const { presence, receive } = startMovement();

      receive(corrected(3, 2));

      expect(presence.getState().positions.get("ada")).toEqual({
        x: 3,
        y: 2,
        facing: "down",
      });
    });
  });
});
