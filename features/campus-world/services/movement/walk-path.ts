import type { MapLayout, Tile } from "campus-world-map";

import { isWalkable } from "./step";

// world sends where someone ended up, not the way they went. Of the two
// L-shaped routes, take the one with no wall on it.
export function walkPath(from: Tile, to: Tile, layout: MapLayout): Tile[] {
  const acrossFirst = route(from, { x: to.x, y: from.y }, to);

  return acrossFirst.every((tile) => isWalkable(layout, tile))
    ? acrossFirst
    : route(from, { x: from.x, y: to.y }, to);
}

function route(from: Tile, corner: Tile, to: Tile): Tile[] {
  return [...straightLine(from, corner), ...straightLine(corner, to)];
}

// The tiles after `from`, up to and including `to`, which share a row or column.
function straightLine(from: Tile, to: Tile): Tile[] {
  const stepX = Math.sign(to.x - from.x);
  const stepY = Math.sign(to.y - from.y);
  const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);

  return Array.from({ length }, (_, index) => ({
    x: from.x + stepX * (index + 1),
    y: from.y + stepY * (index + 1),
  }));
}
