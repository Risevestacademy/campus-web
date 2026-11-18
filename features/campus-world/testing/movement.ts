import type { MapLayout, Tile } from "campus-world-map";

// 5 × 4 tiles, one wall at (2, 1):
//
//   . . . . .
//   . . # . .
//   . . . . .
//   . . . . .
export const movementLayout: MapLayout = {
  widthTiles: 5,
  heightTiles: 4,
  collisions: [{ shape: "rect", x: 2, y: 1, width: 1, height: 1 }],
  spawn: { x: 0, y: 0 },
  spaces: [],
  portals: [],
  desks: [],
};

export function walksOneTileAtATime(
  from: Tile,
  path: readonly Tile[],
): boolean {
  return path.every((tile, index) => {
    const previous = index === 0 ? from : path[index - 1];

    return (
      previous !== undefined &&
      Math.abs(tile.x - previous.x) + Math.abs(tile.y - previous.y) === 1
    );
  });
}
