import type { KAPLAYCtx, Key } from "kaplay";

import {
  cameraScale,
  clampCamera,
  dampPoint,
  dampScale,
  dragCamera,
  readWheel,
  snapToScreenPixel,
  stepZoom,
  visibleArea,
  worldSize,
  type ZoomLevel,
  type ZoomStep,
  zoomToward,
} from "../services/camera";
import { tileCentre } from "../services/tile-centre";
import { loadZoomLevel, saveZoomLevel } from "../services/zoom-preference";

interface Point {
  x: number;
  y: number;
}

interface CampusCameraOptions {
  canvas: HTMLCanvasElement;
  map: { height: number; tileheight: number; tilewidth: number; width: number };
  onZoomChanged: (level: ZoomLevel) => void;
  prefersReducedMotion: () => boolean;
  start: Point;
}

export interface CameraFrame {
  deltaMs: number;
  /** Your drawn tile, once world has placed you. */
  self: Point | undefined;
  walking: boolean;
}

export interface CampusCamera {
  stop: () => void;
  update: (frame: CameraFrame) => void;
  zoom: (step: ZoomStep) => void;
}

// The view a wheel zoom started from, so the point under the cursor stays
// under it on every eased frame, not only the last.
interface ZoomAnchor {
  centre: Point;
  offset: Point;
  scale: number;
}

const ZOOM_KEYS: Partial<Record<Key, ZoomStep>> = { "+": 1, "=": 1, "-": -1 };
const ON_CENTRE: Point = { x: 0, y: 0 };

export function createCampusCamera(
  k: KAPLAYCtx,
  {
    canvas,
    map,
    onZoomChanged,
    prefersReducedMotion,
    start,
  }: CampusCameraOptions,
): CampusCamera {
  const world = worldSize(map);
  let level = loadZoomLevel();
  let scale = scaleOf(level);
  let centre = start;
  let free = false;
  let anchor: ZoomAnchor | null = null;
  let pendingWheel = 0;
  let drag: { id: number; last: Point } | null = null;

  function viewport() {
    return { height: k.height(), width: k.width() };
  }

  function scaleOf(zoomLevel: ZoomLevel): number {
    return cameraScale(zoomLevel, viewport(), world);
  }

  function onMap(target: Point): Point {
    return clampCamera(target, visibleArea(viewport(), scale), world);
  }

  function draw() {
    const drawn = snapToScreenPixel(centre, scale, viewport());
    k.setCamScale(scale);
    k.setCamPos(k.vec2(drawn.x, drawn.y));
  }

  function aimFor(self: Point | undefined): Point {
    if (anchor) {
      return zoomToward(anchor.centre, anchor.offset, {
        from: anchor.scale,
        to: scale,
      });
    }
    return free || !self ? centre : tileCentre(self, map);
  }

  function changeZoom(step: ZoomStep, cursorOffset: Point) {
    const next = stepZoom(level, step);
    if (next === level) return;

    if (free) anchor = { centre, offset: cursorOffset, scale };
    level = next;
    saveZoomLevel(level);
    onZoomChanged(level);
  }

  function cursorOffset(): Point {
    const cursor = k.mousePos();
    return { x: cursor.x - k.width() / 2, y: cursor.y - k.height() / 2 };
  }

  // Browser zoom is Ctrl/Cmd with the same keys; leave it to the browser.
  const keyPress = k.onKeyPress((key) => {
    const step = ZOOM_KEYS[key];
    if (step && !k.isKeyDown(["control", "meta"])) changeZoom(step, ON_CENTRE);
  });

  const scroll = k.onScroll(({ y }) => {
    const wheel = readWheel(pendingWheel, y);
    pendingWheel = wheel.pending;
    if (!wheel.step) return;

    free = true;
    changeZoom(wheel.step, cursorOffset());
  });

  function startDrag(event: PointerEvent) {
    if (event.button !== 0 || event.pointerType === "touch") return;

    drag = {
      id: event.pointerId,
      last: { x: event.clientX, y: event.clientY },
    };
    canvas.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent) {
    if (event.pointerId !== drag?.id) return;

    const moved = {
      x: event.clientX - drag.last.x,
      y: event.clientY - drag.last.y,
    };
    drag.last = { x: event.clientX, y: event.clientY };
    if (moved.x === 0 && moved.y === 0) return;

    free = true;
    anchor = null;
    centre = onMap(dragCamera(centre, moved, scale));
    draw();
  }

  function endDrag(event: PointerEvent) {
    if (event.pointerId === drag?.id) drag = null;
  }

  const pointerListeners = [
    ["pointerdown", startDrag],
    ["pointermove", moveDrag],
    ["pointerup", endDrag],
    ["pointercancel", endDrag],
    ["lostpointercapture", endDrag],
  ] as const;
  for (const [type, listener] of pointerListeners) {
    canvas.addEventListener(type, listener);
  }
  centre = onMap(start);
  draw();

  return {
    update({ deltaMs, self, walking }) {
      if (walking) {
        free = false;
        anchor = null;
      }
      const easedMs = prefersReducedMotion() ? Infinity : deltaMs;
      const target = scaleOf(level);
      scale = dampScale(scale, target, easedMs);

      const aim = onMap(aimFor(self));
      centre = onMap(anchor ? aim : dampPoint(centre, aim, scale, easedMs));
      if (scale === target) anchor = null;
      draw();
    },
    stop() {
      keyPress.cancel();
      scroll.cancel();
      for (const [type, listener] of pointerListeners) {
        canvas.removeEventListener(type, listener);
      }
    },
    zoom(step) {
      changeZoom(step, ON_CENTRE);
    },
  };
}
