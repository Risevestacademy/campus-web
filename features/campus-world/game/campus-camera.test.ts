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

function startCamera() {
  const fake = fakeKaplay({ autoDraw: false });
  fake.kaplay({} as KAPLAYOpt);
  const context = fake.contexts[0]!;
  const canvas = document.createElement("canvas");
  canvas.setPointerCapture = vi.fn();
  const onZoomChanged = vi.fn();
  const camera = createCampusCamera(context.k, {
    canvas,
    map: MAP,
    onZoomChanged,
    start: SPAWN,
  });

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
    k: context.k,
    onZoomChanged,
    pointer,
    position: () => context.k.getCamPos(),
    scale: () => context.k.getCamScale().x,
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
    const { context, onZoomChanged, position, scale } = startCamera();

    context.pressKey(key);

    expect(scale()).toBe(level);
    expect(position()).toEqual(SPAWN);
    expect(onZoomChanged).toHaveBeenCalledExactlyOnceWith(level);
    expect(window.localStorage.getItem(ZOOM_KEY)).toBe(String(level));
  });

  it("zooms out to the whole map below 1x", () => {
    const { context, onZoomChanged, position, scale } = startCamera();

    context.pressKey("-");
    context.pressKey("-");

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
    const { camera, context, position, scale } = startCamera();

    context.resize(320, 240);
    camera.follow({ x: 30, y: 20 }, false);

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
    const { camera, onZoomChanged, scale } = startCamera();

    camera.zoom(1);

    expect(scale()).toBe(3);
    expect(onZoomChanged).not.toHaveBeenCalled();
  });

  it("zooms on the centre when asked from outside the canvas", () => {
    const { camera, position, scale } = startCamera();

    camera.zoom(1);

    expect(scale()).toBe(3);
    expect(position()).toEqual(SPAWN);
  });

  it("keeps the point under the cursor in place when the wheel zooms", () => {
    const { context, position, scale } = startCamera();
    context.moveMouse({ x: 480, y: 240 });

    context.scroll(-100);

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
    const { camera, drag, position } = startCamera();
    drag({ x: 100, y: 100 }, { x: 140, y: 70 });

    camera.follow({ x: 30, y: 20 }, false);
    expect(position()).toEqual({ x: 460, y: 335 });

    camera.follow({ x: 30, y: 20 }, true);
    expect(position()).toEqual({ x: 488, y: 328 });
  });

  it("follows you when nothing has moved the view", () => {
    const { camera, position } = startCamera();

    camera.follow({ x: 30, y: 20 }, false);

    expect(position()).toEqual({ x: 488, y: 328 });
  });

  it("frees the view when the wheel zooms toward the cursor", () => {
    const { camera, context, position } = startCamera();
    context.moveMouse({ x: 480, y: 240 });
    context.scroll(-100);
    const zoomed = { ...position() };

    camera.follow({ x: 30, y: 20 }, false);

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
    const { camera, context, drag, position } = startCamera();
    drag({ x: 0, y: 0 }, { x: 5000, y: 5000 });

    context.resize(1280, 960);
    camera.follow({ x: 30, y: 20 }, false);

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
