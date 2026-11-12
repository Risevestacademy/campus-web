// @vitest-environment node

import type { Space } from "campus-world-map";
import { describe, expect, it } from "vitest";

import { spaceAt } from "./refused-step";

const SPACES: Space[] = [
  {
    key: "room_1",
    name: "room_1",
    kind: "meeting_room",
    bounds: { shape: "rect", x: 2, y: 2, width: 4, height: 3 },
    properties: {},
  },
];

describe("spaceAt", () => {
  it.each([
    [{ x: 2, y: 2 }, "room_1"],
    [{ x: 5, y: 4 }, "room_1"],
    [{ x: 6, y: 4 }, null],
    [{ x: 1, y: 2 }, null],
  ])("finds the space at %j: %s", (tile, key) => {
    expect(spaceAt(SPACES, tile)).toBe(key);
  });
});
