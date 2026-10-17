export interface TileSize {
  tileheight: number;
  tilewidth: number;
}

export function tileCentre(
  tile: { x: number; y: number },
  { tileheight, tilewidth }: TileSize,
) {
  return { x: (tile.x + 0.5) * tilewidth, y: (tile.y + 0.5) * tileheight };
}
