import type { TiledTileLayer } from "./layer-bands";
import { type DecodedTileGid, decodeTileGid } from "./tile-frames";

export interface DrawTileset {
  firstgid: number;
  lastgid: number;
  tileheight: number;
  tileoffset?: { x?: number; y?: number };
}

export interface TileDraw extends Omit<DecodedTileGid, "gid"> {
  frame: number;
  opacity: number;
  tileset: number;
  x: number;
  y: number;
}

export interface LayerDraws {
  cells: Array<TileDraw | undefined>;
  width: number;
}

// Tiled writes tilesets in ascending firstgid order; the search relies on it.
function owningTileset(tilesets: DrawTileset[], gid: number): number {
  let low = 0;
  let high = tilesets.length - 1;
  let owner = -1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    if (tilesets[middle]!.firstgid <= gid) {
      owner = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return owner !== -1 && gid <= tilesets[owner]!.lastgid ? owner : -1;
}

function layerDraws(
  map: { tileheight: number; tilewidth: number },
  layer: TiledTileLayer,
  tilesets: DrawTileset[],
): LayerDraws {
  const offsetX = layer.offsetx ?? 0;
  const offsetY = layer.offsety ?? 0;
  const opacity = layer.opacity ?? 1;

  const cells = layer.data.map((rawGid, index): TileDraw | undefined => {
    if (rawGid === 0) return undefined;

    const { gid, ...transform } = decodeTileGid(rawGid);
    const tilesetIndex = owningTileset(tilesets, gid);
    if (tilesetIndex === -1) return undefined;

    const tileset = tilesets[tilesetIndex]!;
    const column = index % layer.width;
    const row = Math.floor(index / layer.width);

    return {
      ...transform,
      frame: gid - tileset.firstgid,
      opacity,
      tileset: tilesetIndex,
      x:
        column * map.tilewidth +
        map.tilewidth / 2 +
        offsetX +
        (tileset.tileoffset?.x ?? 0),
      y:
        row * map.tileheight +
        map.tileheight -
        tileset.tileheight / 2 +
        offsetY +
        (tileset.tileoffset?.y ?? 0),
    };
  });

  return { cells, width: layer.width };
}

export function buildBandDrawList(
  map: { tileheight: number; tilewidth: number },
  layers: TiledTileLayer[],
  tilesets: DrawTileset[],
): LayerDraws[] {
  return layers.map((layer) => layerDraws(map, layer, tilesets));
}
