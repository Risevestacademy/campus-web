import { describe, expect, it } from "vitest";

import type { MoveOutcome, MoveResultMessage, Player } from "@/core/realtime";
import { movementLayout } from "@/features/campus-world/testing/movement";

import { type PendingMove, reconcile } from "./reconcile";

function result(
  seq: number,
  outcome: MoveOutcome,
  player: Omit<Player, "userId">,
): MoveResultMessage {
  return {
    type: "moveResult",
    seq,
    outcome,
    player: { userId: "ada", ...player },
  };
}

describe("reconcile", () => {
  it("drops every move world has answered, keeping the rest in order", () => {
    const pending: PendingMove[] = [
      { seq: 1, direction: "right" },
      { seq: 2, direction: "right" },
      { seq: 3, direction: "down" },
    ];

    const reconciled = reconcile(
      pending,
      result(2, "moved", { x: 2, y: 0, facing: "right" }),
      movementLayout,
    );

    expect(reconciled.pending).toEqual([{ seq: 3, direction: "down" }]);
  });

  it("changes nothing on screen when every prediction was right", () => {
    const pending: PendingMove[] = [
      { seq: 1, direction: "right" },
      { seq: 2, direction: "right" },
    ];

    expect(
      reconcile(
        pending,
        result(1, "moved", { x: 1, y: 0, facing: "right" }),
        movementLayout,
      ),
    ).toEqual({
      pending: [{ seq: 2, direction: "right" }],
      player: { userId: "ada", x: 2, y: 0, facing: "right" },
    });
  });

  // world refused the first step of a burst; the second is replayed from
  // where world has them, not from where the client drew them.
  it.each<[MoveOutcome, Player["facing"]]>([
    ["blocked", "right"],
    ["too_fast", "down"],
    ["unknown", "down"],
  ])(
    "snaps to world's player on %s, then replays what world has not answered",
    (outcome, facing) => {
      const pending: PendingMove[] = [
        { seq: 1, direction: "right" },
        { seq: 2, direction: "down" },
      ];

      expect(
        reconcile(
          pending,
          result(1, outcome, { x: 0, y: 0, facing }),
          movementLayout,
        ),
      ).toEqual({
        pending: [{ seq: 2, direction: "down" }],
        player: { userId: "ada", x: 0, y: 1, facing: "down" },
      });
    },
  );

  it("replays a pending step into a wall as a turn, as world will answer it", () => {
    const pending: PendingMove[] = [
      { seq: 4, direction: "down" },
      { seq: 5, direction: "right" },
    ];

    expect(
      reconcile(
        pending,
        result(4, "moved", { x: 1, y: 1, facing: "down" }),
        movementLayout,
      ).player,
    ).toEqual({ userId: "ada", x: 1, y: 1, facing: "right" });
  });

  it("takes world's player when nothing is pending", () => {
    expect(
      reconcile(
        [],
        result(9, "too_fast", { x: 3, y: 3, facing: "left" }),
        movementLayout,
      ),
    ).toEqual({
      pending: [],
      player: { userId: "ada", x: 3, y: 3, facing: "left" },
    });
  });
});
