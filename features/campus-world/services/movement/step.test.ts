import { describe, expect, it } from "vitest";

import type { Direction, Player } from "@/core/realtime";
import { movementLayout } from "@/features/campus-world/testing/movement";

import { predictStep, stepFrom } from "./step";

function playerAt(x: number, y: number, facing: Direction = "down"): Player {
  return { userId: "ada", x, y, facing };
}

describe("stepFrom", () => {
  it.each<[Direction, { x: number; y: number }]>([
    ["up", { x: 3, y: 1 }],
    ["down", { x: 3, y: 3 }],
    ["left", { x: 2, y: 2 }],
    ["right", { x: 4, y: 2 }],
  ])("steps %s from (3, 2) in screen terms", (direction, tile) => {
    expect(stepFrom({ x: 3, y: 2 }, direction)).toEqual(tile);
  });
});

describe("predictStep", () => {
  it("moves one tile into an open tile and faces it", () => {
    expect(predictStep(playerAt(0, 0), "right", movementLayout)).toEqual(
      playerAt(1, 0, "right"),
    );
  });

  it("turns to face a wall without moving, as world answers blocked", () => {
    expect(predictStep(playerAt(1, 1), "right", movementLayout)).toEqual(
      playerAt(1, 1, "right"),
    );
  });

  it.each<[string, Player, Direction]>([
    ["left", playerAt(0, 2), "left"],
    ["top", playerAt(3, 0), "up"],
    ["right", playerAt(4, 2), "right"],
    ["bottom", playerAt(3, 3), "down"],
  ])("turns without moving off the %s edge", (_edge, player, direction) => {
    expect(predictStep(player, direction, movementLayout)).toEqual({
      ...player,
      facing: direction,
    });
  });
});
