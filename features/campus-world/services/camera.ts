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

export const ZOOM_LEVELS = [1, 2, 3] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];
export type ZoomStep = -1 | 1;
export const DEFAULT_ZOOM: ZoomLevel = 2;

// One mouse notch is about 100 px; a pinch sends many small deltas.
const WHEEL_STEP_PX = 100;

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
