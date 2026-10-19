import { describe, expect, it, vi } from "vitest";

import { createPresenceStore } from "@/core/presence";
import {
  createWorldMovementChannel,
  type Direction,
  type MoveResultMessage,
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
};

function startMovement(
  reducedMotion = false,
  sendMove: (direction: Direction, seq: number) => boolean = () => true,
) {
  const presence = createPresenceStore();
  const movement = createWorldMovementChannel();
  const sent: Array<{ direction: Direction; seq: number }> = [];
  movement.bind((message) => {
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

  function receive(result: MoveResultMessage) {
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

  it("reconciles a refused move and reports only the non-moved outcome", () => {
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
});
