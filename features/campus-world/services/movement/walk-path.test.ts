import type { Tile } from "campus-world-map";
import { describe, expect, it } from "vitest";

import {
  movementLayout,
  walksOneTileAtATime,
} from "@/features/campus-world/testing/movement";

import { walkPath } from "./walk-path";

function tile(x: number, y: number): Tile {
  return { x, y };
}

const PATHS: [string, Tile, Tile, Tile[]][] = [
  [
    "a straight line along x",
    tile(0, 3),
    tile(3, 3),
    [tile(1, 3), tile(2, 3), tile(3, 3)],
  ],
  [
    "a straight line up",
    tile(4, 3),
    tile(4, 0),
    [tile(4, 2), tile(4, 1), tile(4, 0)],
  ],
  [
    "an L across first",
    tile(0, 2),
    tile(2, 3),
    [tile(1, 2), tile(2, 2), tile(2, 3)],
  ],
  [
    "an L back and up",
    tile(3, 3),
    tile(1, 2),
    [tile(2, 3), tile(1, 3), tile(1, 2)],
  ],
  [
    "an L down first, since across meets the wall",
    tile(1, 1),
    tile(3, 2),
    [tile(1, 2), tile(2, 2), tile(3, 2)],
  ],
];

describe("walkPath", () => {
  it("is empty when they have not moved", () => {
    expect(walkPath(tile(2, 2), tile(2, 2), movementLayout)).toEqual([]);
  });

  it("is null when both L-routes meet a wall", () => {
    expect(walkPath(tile(1, 1), tile(3, 1), movementLayout)).toBeNull();
  });

  it.each(PATHS)("walks %s", (_case, from, to, path) => {
    expect(walkPath(from, to, movementLayout)).toEqual(path);
  });

  it.each(PATHS)("never cuts a diagonal walking %s", (_case, from, to) => {
    const path = walkPath(from, to, movementLayout) ?? [];

    expect(walksOneTileAtATime(from, path)).toBe(true);
    expect(path.at(-1)).toEqual(to);
  });
});
