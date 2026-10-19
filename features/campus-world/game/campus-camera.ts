import type { KAPLAYCtx, Key } from "kaplay";

import {
  clampCamera,
  dragCamera,
  readWheel,
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
  start: Point;
}

export interface CampusCamera {
  follow: (self: Point, walking: boolean) => void;
  stop: () => void;
  zoom: (step: ZoomStep) => void;
}

const ZOOM_KEYS: Partial<Record<Key, ZoomStep>> = { "+": 1, "=": 1, "-": -1 };
const ON_CENTRE: Point = { x: 0, y: 0 };

export function createCampusCamera(
  k: KAPLAYCtx,
  { canvas, map, onZoomChanged, start }: CampusCameraOptions,
): CampusCamera {
  const world = worldSize(map);
  let zoom = loadZoomLevel();
  let centre = start;
  let free = false;
  let pendingWheel = 0;
  let drag: { id: number; last: Point } | null = null;

  function show(target: Point) {
    const viewport = { height: k.height(), width: k.width() };
    centre = clampCamera(target, visibleArea(viewport, zoom), world);
    k.setCamScale(zoom);
    k.setCamPos(k.vec2(centre.x, centre.y));
  }

  function changeZoom(step: ZoomStep, cursorOffset: Point) {
    const next = stepZoom(zoom, step);
    if (next === zoom) return;

    const target = zoomToward(centre, cursorOffset, { from: zoom, to: next });
    zoom = next;
    show(target);
    saveZoomLevel(zoom);
    onZoomChanged(zoom);
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
    show(dragCamera(centre, moved, zoom));
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
  show(start);

  return {
    follow(self, walking) {
      if (walking) free = false;
      show(free ? centre : tileCentre(self, map));
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
