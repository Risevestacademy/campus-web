import { describe, expect, it } from "vitest";

import { clampCamera } from "./camera";

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
