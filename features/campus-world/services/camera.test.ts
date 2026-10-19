import { describe, expect, it } from "vitest";

import {
  cameraScale,
  clampCamera,
  dragCamera,
  readWheel,
  spawnTarget,
  stepZoom,
  visibleArea,
  type ZoomLevel,
  type ZoomStep,
  zoomToward,
} from "./camera";

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

  it.each([
    ["top-left", { x: 16, y: 16 }, { x: 400 / 3, y: 100 }],
    ["bottom-right", { x: 5104, y: 3280 }, { x: 5120 - 400 / 3, y: 3196 }],
  ])("clamps a %s target to the map shown at 3x", (_, target, expected) => {
    expect(clampCamera(target, visibleArea(viewport, 3), map)).toEqual(
      expected,
    );
  });
});

describe("stepZoom", () => {
  it.each<[ZoomLevel, ZoomStep, ZoomLevel]>([
    ["whole", -1, "whole"],
    ["whole", 1, 1],
    [1, -1, "whole"],
    [1, 1, 2],
    [2, 1, 3],
    [3, 1, 3],
    [3, -1, 2],
  ])("moves %s by %i to %s", (level, step, expected) => {
    expect(stepZoom(level, step)).toBe(expected);
  });
});

describe("cameraScale", () => {
  const campus = { height: 3296, width: 5120 };

  it.each<[ZoomLevel, { height: number; width: number }, number]>([
    [1, { height: 600, width: 900 }, 1],
    [3, { height: 600, width: 900 }, 3],
    ["whole", { height: 600, width: 900 }, 900 / 5120],
    ["whole", { height: 900, width: 600 }, 600 / 5120],
    ["whole", { height: 300, width: 1800 }, 300 / 3296],
  ])(
    "draws %s on a %o canvas at the right scale",
    (level, viewport, expected) => {
      expect(cameraScale(level, viewport, campus)).toBe(expected);
    },
  );

  it("shows the whole map on both axes", () => {
    const viewport = { height: 600, width: 900 };
    const visible = visibleArea(
      viewport,
      cameraScale("whole", viewport, campus),
    );

    expect(visible.width).toBeGreaterThanOrEqual(campus.width);
    expect(visible.height).toBeGreaterThanOrEqual(campus.height);
  });

  it("never zooms in past 1x to fit a small map", () => {
    expect(
      cameraScale(
        "whole",
        { height: 600, width: 900 },
        { height: 96, width: 128 },
      ),
    ).toBe(1);
  });
});

describe("visibleArea", () => {
  it.each([
    [1, { height: 600, width: 800 }],
    [2, { height: 300, width: 400 }],
    [3, { height: 200, width: 800 / 3 }],
  ])("shows the viewport divided by %ix", (zoom, expected) => {
    expect(visibleArea({ height: 600, width: 800 }, zoom)).toEqual(expected);
  });
});

describe("zoomToward", () => {
  const centre = { x: 500, y: 400 };

  it("keeps the centre when the cursor is on it", () => {
    expect(zoomToward(centre, { x: 0, y: 0 }, { from: 1, to: 2 })).toEqual(
      centre,
    );
  });

  it("moves halfway toward a cursor when doubling the scale", () => {
    expect(zoomToward(centre, { x: 100, y: -60 }, { from: 1, to: 2 })).toEqual({
      x: 550,
      y: 370,
    });
  });

  it("keeps the world point under the cursor", () => {
    const cursor = { x: 120, y: 90 };
    const next = zoomToward(centre, cursor, { from: 2, to: 3 });

    expect(next.x + cursor.x / 3).toBeCloseTo(centre.x + cursor.x / 2);
    expect(next.y + cursor.y / 3).toBeCloseTo(centre.y + cursor.y / 2);
  });

  it("returns to the start after zooming in and back out", () => {
    const cursor = { x: 120, y: 90 };
    const zoomedIn = zoomToward(centre, cursor, { from: 2, to: 3 });
    const back = zoomToward(zoomedIn, cursor, { from: 3, to: 2 });

    expect(back.x).toBeCloseTo(centre.x);
    expect(back.y).toBeCloseTo(centre.y);
  });
});

describe("dragCamera", () => {
  it.each([
    [1, { x: 460, y: 430 }],
    [2, { x: 480, y: 415 }],
  ])("moves the map with the pointer at %ix", (zoom, expected) => {
    expect(dragCamera({ x: 500, y: 400 }, { x: 40, y: -30 }, zoom)).toEqual(
      expected,
    );
  });
});

describe("readWheel", () => {
  it("collects small pinch deltas until they make one step", () => {
    let pending = 0;
    for (const deltaY of [30, 30, 30]) {
      const read = readWheel(pending, deltaY);
      expect(read.step).toBeNull();
      pending = read.pending;
    }

    expect(readWheel(pending, 10)).toEqual({ pending: 0, step: -1 });
  });

  it("zooms in on one upward notch", () => {
    expect(readWheel(0, -100)).toEqual({ pending: 0, step: 1 });
  });

  it("moves one level on a fast flick", () => {
    expect(readWheel(0, 300)).toEqual({ pending: 0, step: -1 });
  });

  it("cancels deltas that change direction", () => {
    expect(readWheel(60, -40)).toEqual({ pending: 20, step: null });
  });
});

describe("spawnTarget", () => {
  const map = { height: 100, tileheight: 16, tilewidth: 16, width: 200 };

  it("aims at the middle of the spawn tile", () => {
    expect(spawnTarget(map, { spawn: { x: 50, y: 40 } })).toEqual({
      x: 808,
      y: 648,
    });
  });

  it("aims at the middle of the map when the layout has no spawn", () => {
    expect(spawnTarget(map, { spawn: null })).toEqual({ x: 1600, y: 800 });
  });
});
