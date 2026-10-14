import { describe, expect, it } from "vitest";

import { clampCamera, spawnCamera } from "./camera";

describe("clampCamera", () => {
  const viewport = { height: 600, width: 800 };
  const map = { height: 3296, width: 5120 };

  it.each([
    ["top-left", { x: 16, y: 16 }, { x: 400, y: 300 }],
    ["inside", { x: 2416, y: 1904 }, { x: 2416, y: 1904 }],
    ["bottom-right", { x: 5104, y: 3280 }, { x: 4720, y: 2996 }],
  ])("clamps a %s target to the drawable map", (_, target, expected) => {
    expect(clampCamera(target, viewport, map)).toEqual(expected);
  });

  it("centres a map smaller than the viewport", () => {
    expect(
      clampCamera({ x: 32, y: 32 }, viewport, { height: 192, width: 320 }),
    ).toEqual({ x: 160, y: 96 });
  });
});

describe("spawnCamera", () => {
  const map = { height: 100, tileheight: 16, tilewidth: 16, width: 200 };
  const viewport = { height: 320, width: 480 };

  it("centres on the middle of the spawn tile", () => {
    expect(spawnCamera(map, { spawn: { x: 50, y: 40 } }, viewport)).toEqual({
      x: 808,
      y: 648,
    });
  });

  it("centres on the map when the layout has no spawn", () => {
    expect(spawnCamera(map, { spawn: null }, viewport)).toEqual({
      x: 1600,
      y: 800,
    });
  });

  it("keeps a spawn near the edge inside the drawable map", () => {
    expect(spawnCamera(map, { spawn: { x: 0, y: 0 } }, viewport)).toEqual({
      x: 240,
      y: 160,
    });
  });
});
