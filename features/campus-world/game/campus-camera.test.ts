import type { KAPLAYOpt } from "kaplay";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANALYTICS_EVENTS,
  analyticsEventSchemas,
} from "@/core/analytics/events";

import { ZOOM_LEVELS } from "../services/camera";
import { fakeKaplay } from "../testing/fake-kaplay";
import { createCampusCamera } from "./campus-camera";

// 60 × 40 tiles of 16 px: a 960 × 640 world behind a 640 × 480 viewport.
const MAP = { height: 40, tileheight: 16, tilewidth: 16, width: 60 };
const SPAWN = { x: 480, y: 320 };
const ZOOM_KEY = "campus-world-zoom";

interface Point {
  x: number;
  y: number;
}

function startCamera() {
  const fake = fakeKaplay({ autoDraw: false });
  fake.kaplay({} as KAPLAYOpt);
  const context = fake.contexts[0]!;
  const canvas = document.createElement("canvas");
  canvas.setPointerCapture = vi.fn();
  const onZoomChanged = vi.fn();
  let reducedMotion = false;
  const camera = createCampusCamera(context.k, {
    canvas,
    map: MAP,
    onZoomChanged,
    prefersReducedMotion: () => reducedMotion,
    start: SPAWN,
  });

  function frame(self?: Point, walking = false, deltaMs = 16) {
    camera.update({ deltaMs, self, walking });
  }

  // Long enough for every eased value to land on its target.
  function settle(self?: Point, walking = false) {
    frame(self, walking, 10_000);
  }

  function pointer(
    type: string,
    at: { x: number; y: number },
    init: PointerEventInit = {},
  ) {
    const event = new PointerEvent(type, {
      bubbles: true,
      button: 0,
      cancelable: true,
      clientX: at.x,
      clientY: at.y,
      pointerId: 1,
      pointerType: "mouse",
      ...init,
    });
    canvas.dispatchEvent(event);
    return event;
  }

  function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
    pointer("pointerdown", from);
    pointer("pointermove", to);
    pointer("pointerup", to);
  }

  return {
    camera,
    canvas,
    context,
    drag,
    frame,
    k: context.k,
    onZoomChanged,
    pointer,
    position: () => ({ ...context.k.getCamPos() }),
    reduceMotion: () => {
      reducedMotion = true;
    },
    scale: () => context.k.getCamScale().x,
    settle,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("createCampusCamera", () => {
  it("starts at 2x on the spawn point", () => {
    const { position, scale } = startCamera();

    expect(scale()).toBe(2);
    expect(position()).toEqual(SPAWN);
  });

  it("starts at the level the viewer saved", () => {
    window.localStorage.setItem(ZOOM_KEY, "3");

    expect(startCamera().scale()).toBe(3);
  });

  it.each([
    ["+", 3],
    ["=", 3],
    ["-", 1],
  ])("zooms with %s and remembers the level", (key, level) => {
    const { context, onZoomChanged, position, scale, settle } = startCamera();

    context.pressKey(key);
    settle();

    expect(scale()).toBe(level);
    expect(position()).toEqual(SPAWN);
    expect(onZoomChanged).toHaveBeenCalledExactlyOnceWith(level);
    expect(window.localStorage.getItem(ZOOM_KEY)).toBe(String(level));
  });

  it("zooms out to the whole map below 1x", () => {
    const { context, onZoomChanged, position, scale, settle } = startCamera();

    context.pressKey("-");
    context.pressKey("-");
    settle();

    expect(scale()).toBe(2 / 3);
    expect(position()).toEqual({ x: 480, y: 320 });
    expect(onZoomChanged).toHaveBeenLastCalledWith("whole");
    expect(window.localStorage.getItem(ZOOM_KEY)).toBe('"whole"');
  });

  it("starts on the whole map when the viewer left it there", () => {
    window.localStorage.setItem(ZOOM_KEY, '"whole"');

    expect(startCamera().scale()).toBe(2 / 3);
  });

  it("refits the whole map when the window changes", () => {
    window.localStorage.setItem(ZOOM_KEY, '"whole"');
    const { context, position, scale, settle } = startCamera();

    context.resize(320, 240);
    settle({ x: 30, y: 20 });

    expect(scale()).toBe(1 / 3);
    expect(position()).toEqual({ x: 480, y: 320 });
  });

  it.each(["control", "meta"])(
    "leaves %s zoom keys to the browser",
    (modifier) => {
      const { context, onZoomChanged, scale } = startCamera();

      context.pressKey(modifier);
      context.pressKey("=");

      expect(scale()).toBe(2);
      expect(onZoomChanged).not.toHaveBeenCalled();
    },
  );

  it("reports nothing when already at the closest level", () => {
    window.localStorage.setItem(ZOOM_KEY, "3");
    const { camera, onZoomChanged, scale, settle } = startCamera();

    camera.zoom(1);
    settle();

    expect(scale()).toBe(3);
    expect(onZoomChanged).not.toHaveBeenCalled();
  });

  it("zooms on the centre when asked from outside the canvas", () => {
    const { camera, position, scale, settle } = startCamera();

    camera.zoom(1);
    settle();

    expect(scale()).toBe(3);
    expect(position()).toEqual(SPAWN);
  });

  it("keeps the point under the cursor in place when the wheel zooms", () => {
    const { context, position, scale, settle } = startCamera();
    context.moveMouse({ x: 480, y: 240 });

    context.scroll(-100);
    settle();

    expect(scale()).toBe(3);
    expect(position().x + 160 / 3).toBeCloseTo(SPAWN.x + 160 / 2);
    expect(position().y).toBe(SPAWN.y);
  });

  it("moves the map with a dragged pointer at the current scale", () => {
    const { drag, position } = startCamera();

    drag({ x: 100, y: 100 }, { x: 140, y: 70 });

    expect(position()).toEqual({ x: 460, y: 335 });
  });

  it("leaves the press free to focus the canvas", () => {
    const { pointer } = startCamera();

    const press = pointer("pointerdown", { x: 100, y: 100 });

    expect(press.defaultPrevented).toBe(false);
  });

  it("keeps the dragged view until you walk", () => {
    const { drag, position, settle } = startCamera();
    drag({ x: 100, y: 100 }, { x: 140, y: 70 });

    settle({ x: 30, y: 20 });
    expect(position()).toEqual({ x: 460, y: 335 });

    settle({ x: 30, y: 20 }, true);
    expect(position()).toEqual({ x: 488, y: 328 });
  });

  it("follows you when nothing has moved the view", () => {
    const { position, settle } = startCamera();

    settle({ x: 30, y: 20 });

    expect(position()).toEqual({ x: 488, y: 328 });
  });

  it("frees the view when the wheel zooms toward the cursor", () => {
    const { context, position, settle } = startCamera();
    context.moveMouse({ x: 480, y: 240 });
    context.scroll(-100);
    settle();
    const zoomed = position();

    settle({ x: 30, y: 20 });

    expect(position()).toEqual(zoomed);
  });

  it("ignores touch, which belongs to the mobile app", () => {
    const { pointer, position } = startCamera();
    const touch = { pointerType: "touch" };

    pointer("pointerdown", { x: 100, y: 100 }, touch);
    pointer("pointermove", { x: 140, y: 70 }, touch);

    expect(position()).toEqual(SPAWN);
  });

  it("stops moving the map once the pointer is released", () => {
    const { drag, pointer, position } = startCamera();
    drag({ x: 100, y: 100 }, { x: 140, y: 70 });

    pointer("pointermove", { x: 400, y: 400 });

    expect(position()).toEqual({ x: 460, y: 335 });
  });

  it("stops at the map's edge however far you drag", () => {
    const { drag, position } = startCamera();

    drag({ x: 0, y: 0 }, { x: 5000, y: 5000 });

    expect(position()).toEqual({ x: 160, y: 120 });
  });

  it("keeps a dragged view on the map after the viewport grows", () => {
    const { context, drag, position, settle } = startCamera();
    drag({ x: 0, y: 0 }, { x: 5000, y: 5000 });

    context.resize(1280, 960);
    settle({ x: 30, y: 20 });

    expect(position()).toEqual({ x: 320, y: 240 });
  });

  it("stops listening once stopped", () => {
    const { camera, context, drag, position, scale } = startCamera();

    camera.stop();
    context.pressKey("+");
    drag({ x: 100, y: 100 }, { x: 140, y: 70 });

    expect(context.inputHandlers()).toBe(0);
    expect(scale()).toBe(2);
    expect(position()).toEqual(SPAWN);
  });

  it("only reports levels the analytics contract accepts", () => {
    const schema =
      analyticsEventSchemas[ANALYTICS_EVENTS.CAMPUS_WORLD_CAMERA_ZOOMED];

    for (const level of ZOOM_LEVELS) {
      expect(schema.safeParse({ level }).success).toBe(true);
    }
    expect(schema.safeParse({ level: 4 }).success).toBe(false);
  });
});

// The map is 960 × 640 world px behind a 640 × 480 viewport.
function showsOnlyMap(centre: Point, scale: number): boolean {
  const snapTolerance = 0.5 / scale + 1e-9;
  const fits = (value: number, visible: number, world: number) =>
    world <= visible
      ? Math.abs(value - world / 2) <= snapTolerance
      : value - visible / 2 >= -snapTolerance &&
        value + visible / 2 <= world + snapTolerance;
  return fits(centre.x, 640 / scale, 960) && fits(centre.y, 480 / scale, 640);
}

describe("createCampusCamera easing", () => {
  it("eases toward a new level instead of jumping", () => {
    const { context, frame, onZoomChanged, scale } = startCamera();

    context.pressKey("+");
    frame();

    expect(scale()).toBeGreaterThan(2);
    expect(scale()).toBeLessThan(3);
    expect(onZoomChanged).toHaveBeenCalledExactlyOnceWith(3);
    expect(window.localStorage.getItem(ZOOM_KEY)).toBe("3");
  });

  it("lands exactly on the new level within half a second", () => {
    const { context, frame, scale } = startCamera();

    context.pressKey("+");
    for (let elapsedMs = 0; elapsedMs < 500; elapsedMs += 16) frame();

    expect(scale()).toBe(3);
  });

  it("picks up from the drawn scale when you zoom again mid-way", () => {
    const { context, frame, scale } = startCamera();
    context.pressKey("+");
    frame();
    const midway = scale();

    context.pressKey("-");
    frame();

    expect(scale()).toBeLessThan(midway);
    expect(scale()).toBeGreaterThan(2);
  });

  it("keeps the point under the cursor in place on every frame of a wheel zoom", () => {
    const { context, frame, position, scale } = startCamera();
    context.moveMouse({ x: 480, y: 240 });
    const underCursor = SPAWN.x + 160 / 2;

    context.scroll(-100);
    for (let elapsedMs = 0; elapsedMs < 600; elapsedMs += 16) {
      frame();
      const drift = Math.abs(position().x + 160 / scale() - underCursor);
      expect(drift * scale()).toBeLessThanOrEqual(0.5 + 1e-9);
    }
    expect(scale()).toBe(3);
  });

  it("glides back to you when you walk after a drag", () => {
    const { drag, frame, position, settle } = startCamera();
    const you = { x: 30, y: 20 };
    drag({ x: 100, y: 100 }, { x: 140, y: 70 });
    const dragged = position();

    frame(you, true);
    const first = position();
    settle(you);

    const gap = Math.hypot(488 - dragged.x, 328 - dragged.y);
    const moved = Math.hypot(first.x - dragged.x, first.y - dragged.y);
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThanOrEqual(gap / 4);
    expect(position()).toEqual({ x: 488, y: 328 });
  });

  it("trails you while you walk and lands on you once you stop", () => {
    const { frame, position } = startCamera();
    const trailing: number[] = [];

    for (let elapsedMs = 0; elapsedMs <= 1000; elapsedMs += 16) {
      const you = { x: 30 + elapsedMs / 100, y: 20 };
      frame(you, true);
      trailing.push((you.x + 0.5) * 16 - position().x);
    }
    const stopped = { x: 40, y: 20 };
    for (let elapsedMs = 0; elapsedMs < 1000; elapsedMs += 16) frame(stopped);

    expect(Math.min(...trailing)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...trailing)).toBeLessThanOrEqual(16);
    expect(position()).toEqual({ x: 648, y: 328 });
  });

  it("moves the map one to one with a drag, even mid-zoom", () => {
    const { context, drag, frame, position, scale } = startCamera();
    context.pressKey("+");
    frame();
    const before = position();

    drag({ x: 100, y: 100 }, { x: 140, y: 70 });

    expect(position().x).toBeCloseTo(before.x - 40 / scale(), 1);
    expect(position().y).toBeCloseTo(before.y + 30 / scale(), 1);
  });

  it("never shows past the map's edge on any frame of a zoom out", () => {
    const { context, drag, frame, position, scale } = startCamera();
    drag({ x: 0, y: 0 }, { x: 5000, y: 5000 });

    context.pressKey("-");
    context.pressKey("-");
    for (let elapsedMs = 0; elapsedMs < 600; elapsedMs += 16) {
      frame();
      expect(showsOnlyMap(position(), scale())).toBe(true);
    }
    expect(scale()).toBe(2 / 3);
  });

  it("draws the map on whole screen pixels on every frame", () => {
    const { frame, position, scale } = startCamera();

    for (let elapsedMs = 0; elapsedMs <= 500; elapsedMs += 16) {
      frame({ x: 30 + elapsedMs / 100, y: 20 + elapsedMs / 300 }, true);
      const offsetX = position().x * scale() - 320;
      const offsetY = position().y * scale() - 240;
      expect(Math.abs(offsetX - Math.round(offsetX))).toBeLessThan(1e-9);
      expect(Math.abs(offsetY - Math.round(offsetY))).toBeLessThan(1e-9);
    }
  });

  it("lands every change at once under reduced motion", () => {
    const { context, drag, frame, position, reduceMotion, scale } =
      startCamera();
    reduceMotion();

    context.pressKey("+");
    frame();
    expect(scale()).toBe(3);

    drag({ x: 100, y: 100 }, { x: 140, y: 70 });
    frame({ x: 30, y: 20 }, true);
    expect(position()).toEqual({ x: 488, y: 328 });
  });
});
