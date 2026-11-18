import { contains, type Space, type Tile } from "campus-world-map";

// A refused step or walk. A step names no space and says nothing about
// asking, so its space is the one at the tile it faced and `mayAsk` is null.
export interface EntryRefusal {
  mayAsk: boolean | null;
  spaceKey: string | null;
}

export function spaceAt(spaces: readonly Space[], tile: Tile): string | null {
  return spaces.find(({ bounds }) => contains(bounds, tile))?.key ?? null;
}
