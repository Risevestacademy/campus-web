import type { MapLayout } from "campus-world-map";

import { tileCentre } from "./tile-centre";

interface Size {
  height: number;
  width: number;
}

interface Point {
  x: number;
  y: number;
}

interface TileGrid {
  height: number;
  tileheight: number;
  tilewidth: number;
  width: number;
}

export const ZOOM_LEVELS = ["whole", 1, 2, 3] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];
export type ZoomStep = -1 | 1;
export const DEFAULT_ZOOM: ZoomLevel = 2;

// One mouse notch is about 100 px; a pinch sends many small deltas.
const WHEEL_STEP_PX = 100;

// Per second. While you walk, the camera trails you by speed / FOLLOW_RATE.
export const FOLLOW_RATE = 10;
export const ZOOM_RATE = 14;
const SETTLED_SCREEN_PX = 0.05;
// Under half a screen pixel at the edge of a 1920 px canvas.
const SETTLED_LOG_SCALE = 5e-4;

function clampAxis(target: number, visible: number, map: number): number {
  if (map <= visible) {
    return map / 2;
  }

  const halfVisible = visible / 2;
  return Math.min(Math.max(target, halfVisible), map - halfVisible);
}

export function clampCamera(target: Point, visible: Size, map: Size): Point {
  return {
    x: clampAxis(target.x, visible.width, map.width),
    y: clampAxis(target.y, visible.height, map.height),
  };
}

export function worldSize(map: TileGrid): Size {
  return {
    height: map.height * map.tileheight,
    width: map.width * map.tilewidth,
  };
}

export function spawnTarget(
  map: TileGrid,
  layout: Pick<MapLayout, "spawn">,
): Point {
  const world = worldSize(map);
  return layout.spawn
    ? tileCentre(layout.spawn, map)
    : { x: world.width / 2, y: world.height / 2 };
}

export function stepZoom(level: ZoomLevel, step: ZoomStep): ZoomLevel {
  const index = ZOOM_LEVELS.indexOf(level) + step;
  return ZOOM_LEVELS[Math.min(Math.max(index, 0), ZOOM_LEVELS.length - 1)]!;
}

// Whole map fits the world in the canvas, but never zooms in past 1x.
export function cameraScale(
  level: ZoomLevel,
  viewport: Size,
  world: Size,
): number {
  if (level !== "whole") return level;
  return Math.min(
    1,
    viewport.width / world.width,
    viewport.height / world.height,
  );
}

export function visibleArea(viewport: Size, zoom: number): Size {
  return { height: viewport.height / zoom, width: viewport.width / zoom };
}

// Keeps the world point under the cursor under it after the scale changes.
export function zoomToward(
  centre: Point,
  cursorOffset: Point,
  { from, to }: { from: number; to: number },
): Point {
  return {
    x: centre.x + cursorOffset.x / from - cursorOffset.x / to,
    y: centre.y + cursorOffset.y / from - cursorOffset.y / to,
  };
}

export function dragCamera(centre: Point, drag: Point, zoom: number): Point {
  return { x: centre.x - drag.x / zoom, y: centre.y - drag.y / zoom };
}

// A fast flick moves one level, never several.
export function readWheel(
  pending: number,
  deltaY: number,
): { pending: number; step: ZoomStep | null } {
  const total = pending + deltaY;
  if (total <= -WHEEL_STEP_PX) return { pending: 0, step: 1 };
  if (total >= WHEEL_STEP_PX) return { pending: 0, step: -1 };
  return { pending: total, step: null };
}

// Frame-rate independent ease-out: 30, 60 and 144 fps trace one path.
export function damp(
  current: number,
  target: number,
  rate: number,
  deltaMs: number,
): number {
  const remaining = Math.exp((-rate * deltaMs) / 1000);
  return remaining === 0 ? target : target + (current - target) * remaining;
}

// Zoom reads as a ratio, so 1x to 2x should feel like 2x to 4x.
export function dampScale(
  current: number,
  target: number,
  deltaMs: number,
): number {
  const eased = damp(Math.log(current), Math.log(target), ZOOM_RATE, deltaMs);
  return Math.abs(eased - Math.log(target)) < SETTLED_LOG_SCALE
    ? target
    : Math.exp(eased);
}

export function dampPoint(
  current: Point,
  target: Point,
  scale: number,
  deltaMs: number,
): Point {
  const axis = (from: number, to: number) => {
    const eased = damp(from, to, FOLLOW_RATE, deltaMs);
    return Math.abs(eased - to) * scale < SETTLED_SCREEN_PX ? to : eased;
  };
  return { x: axis(current.x, target.x), y: axis(current.y, target.y) };
}

// Crisp art shimmers under a sub-pixel camera. Only the drawn position snaps;
// snapping the eased one would make a slow glide stair-step to a halt. Art
// pixels meet screen pixels only at whole scales, so others pass through.
export function snapToScreenPixel(
  centre: Point,
  scale: number,
  viewport: Size,
): Point {
  if (!Number.isInteger(scale)) return centre;

  const snap = (value: number, visible: number) =>
    (Math.round(value * scale - visible / 2) + visible / 2) / scale;
  return {
    x: snap(centre.x, viewport.width),
    y: snap(centre.y, viewport.height),
  };
}
