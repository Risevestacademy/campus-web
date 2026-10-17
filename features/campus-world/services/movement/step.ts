import { blocked, type MapLayout, type Tile } from "campus-world-map";

import type { Direction, Player } from "@/core/realtime";

const OFFSETS: Record<Direction, Tile> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function stepFrom(tile: Tile, direction: Direction): Tile {
  const offset = OFFSETS[direction];
  return { x: tile.x + offset.x, y: tile.y + offset.y };
}

// world's own test: the edge blocks, and so does any tile `blocked` reports.
export function isWalkable(layout: MapLayout, tile: Tile): boolean {
  return isInside(layout, tile) && !blocked(layout, tile);
}

function isInside(layout: MapLayout, { x, y }: Tile): boolean {
  return x >= 0 && y >= 0 && x < layout.widthTiles && y < layout.heightTiles;
}

export function predictStep(
  player: Player,
  direction: Direction,
  layout: MapLayout,
): Player {
  const turned = { ...player, facing: direction };
  const target = stepFrom(player, direction);
  return isWalkable(layout, target) ? { ...turned, ...target } : turned;
}
