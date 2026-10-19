import { describe, expect, it } from "vitest";

import {
  cameraScale,
  clampCamera,
  damp,
  dampPoint,
  dampScale,
  dragCamera,
  readWheel,
  snapToScreenPixel,
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

function runFrames<T>(
  value: T,
  frames: number[],
  ease: (value: T, deltaMs: number) => T,
): T {
  return frames.reduce(ease, value);
}

const framesFor = (fps: number, totalMs: number) =>
  Array.from({ length: Math.round((totalMs * fps) / 1000) }, () => 1000 / fps);

describe("damp", () => {
  it.each([30, 60, 144])("traces one path at %i fps", (fps) => {
    const eased = runFrames(0, framesFor(fps, 1000), (value, deltaMs) =>
      damp(value, 100, 3, deltaMs),
    );

    expect(eased).toBeCloseTo(100 * (1 - Math.exp(-3)), 9);
  });

  it("traces the same path when frames arrive unevenly", () => {
    const even = runFrames(0, [20, 20, 20, 20], (value, deltaMs) =>
      damp(value, 100, 10, deltaMs),
    );
    const uneven = runFrames(0, [5, 41, 9, 25], (value, deltaMs) =>
      damp(value, 100, 10, deltaMs),
    );

    expect(uneven).toBeCloseTo(even, 9);
  });

  it("never passes the target, however long the frame", () => {
    for (const deltaMs of [1, 16, 100, 5_000]) {
      expect(damp(0, 100, 10, deltaMs)).toBeLessThanOrEqual(100);
      expect(damp(200, 100, 10, deltaMs)).toBeGreaterThanOrEqual(100);
    }
  });

  it("lands on the target when the frame is infinite", () => {
    expect(damp(3, 100, 10, Infinity)).toBe(100);
  });
});

describe("dampScale", () => {
  it("covers the same share of 1x to 2x as of 2x to 4x", () => {
    const low = Math.log(dampScale(1, 2, 16) / 1) / Math.log(2);
    const high = Math.log(dampScale(2, 4, 16) / 2) / Math.log(2);

    expect(low).toBeCloseTo(high, 9);
  });

  it("covers a quarter of a level or less in one 60 fps frame", () => {
    const share = Math.log(dampScale(2, 3, 1000 / 60) / 2) / Math.log(1.5);

    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThanOrEqual(0.25);
  });

  it.each([
    [2, 3],
    [3, 2],
    [0.37, 1],
  ])(
    "lands exactly on %s to %s once the gap is too small to see",
    (from, to) => {
      let scale = from;
      for (let frame = 0; frame < 120 && scale !== to; frame += 1) {
        scale = dampScale(scale, to, 16);
      }

      expect(scale).toBe(to);
    },
  );

  it("lands at once when the frame is infinite", () => {
    expect(dampScale(2, 3, Infinity)).toBe(3);
  });
});

describe("dampPoint", () => {
  it("eases each axis toward the target", () => {
    const eased = dampPoint({ x: 0, y: 100 }, { x: 100, y: 0 }, 2, 16);

    expect(eased.x).toBeGreaterThan(0);
    expect(eased.x).toBeLessThan(25);
    expect(eased.y).toBeLessThan(100);
    expect(eased.y).toBeGreaterThan(75);
  });

  it("lands exactly once the gap is under a twentieth of a screen pixel", () => {
    expect(dampPoint({ x: 99.99, y: 0 }, { x: 100, y: 0 }, 2, 16)).toEqual({
      x: 100,
      y: 0,
    });
  });

  it("keeps easing a gap that still shows at a higher scale", () => {
    expect(dampPoint({ x: 99.9, y: 0 }, { x: 100, y: 0 }, 3, 1).x).not.toBe(
      100,
    );
  });
});

describe("snapToScreenPixel", () => {
  const screenOffset = (centre: number, scale: number, visible: number) =>
    centre * scale - visible / 2;

  it.each([
    [1, { height: 480, width: 640 }],
    [2, { height: 480, width: 640 }],
    [3, { height: 480, width: 640 }],
    [2, { height: 481, width: 641 }],
  ])("puts the map on whole screen pixels at %sx on %o", (scale, viewport) => {
    const snapped = snapToScreenPixel(
      { x: 480.123, y: 320.987 },
      scale,
      viewport,
    );

    const x = screenOffset(snapped.x, scale, viewport.width);
    const y = screenOffset(snapped.y, scale, viewport.height);
    expect(Math.abs(x - Math.round(x))).toBeLessThan(1e-9);
    expect(Math.abs(y - Math.round(y))).toBeLessThan(1e-9);
  });

  it("moves the camera less than half a screen pixel", () => {
    const centre = { x: 480.123, y: 320.987 };
    const snapped = snapToScreenPixel(centre, 3, { height: 480, width: 640 });

    expect(Math.abs(snapped.x - centre.x) * 3).toBeLessThanOrEqual(0.5);
    expect(Math.abs(snapped.y - centre.y) * 3).toBeLessThanOrEqual(0.5);
  });

  it("leaves the camera alone between whole scales", () => {
    const centre = { x: 480.123, y: 320.987 };

    expect(snapToScreenPixel(centre, 0.37, { height: 480, width: 640 })).toBe(
      centre,
    );
  });

  it("leaves a snapped camera where it is", () => {
    const viewport = { height: 480, width: 640 };
    const once = snapToScreenPixel({ x: 480.123, y: 320.987 }, 2, viewport);

    expect(snapToScreenPixel(once, 2, viewport)).toEqual(once);
  });
});
