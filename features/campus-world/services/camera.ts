import type { MapLayout } from "campus-world-map";

interface Size {
  height: number;
  width: number;
}

interface Point {
  x: number;
  y: number;
}

function clampAxis(target: number, viewport: number, map: number): number {
  if (map <= viewport) {
    return map / 2;
  }

  const halfViewport = viewport / 2;
  return Math.min(Math.max(target, halfViewport), map - halfViewport);
}

export function clampCamera(target: Point, viewport: Size, map: Size): Point {
  return {
    x: clampAxis(target.x, viewport.width, map.width),
    y: clampAxis(target.y, viewport.height, map.height),
  };
}

interface TileGrid {
  height: number;
  tileheight: number;
  tilewidth: number;
  width: number;
}

export function spawnCamera(
  map: TileGrid,
  layout: Pick<MapLayout, "spawn">,
  viewport: Size,
): Point {
  const world = {
    height: map.height * map.tileheight,
    width: map.width * map.tilewidth,
  };
  const target = layout.spawn
    ? {
        x: (layout.spawn.x + 0.5) * map.tilewidth,
        y: (layout.spawn.y + 0.5) * map.tileheight,
      }
    : { x: world.width / 2, y: world.height / 2 };

  return clampCamera(target, viewport, world);
}
