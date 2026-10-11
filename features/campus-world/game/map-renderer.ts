import type { KAPLAYCtx } from "kaplay";

import type { TiledTileLayer } from "../services/map/layer-bands";
import type {
  CampusTiledMap,
  LoadedCampusMap,
} from "../services/map/load-campus-map";
import { decodeTileGid } from "../services/map/tile-frames";

export interface RenderTileset {
  firstgid: number;
  lastgid: number;
  name: string;
  spriteName: string;
  tileheight: number;
  tileoffset?: { x?: number; y?: number };
  tilewidth: number;
}

function visibleTileBounds(k: KAPLAYCtx, map: CampusTiledMap) {
  const camera = k.getCamPos();
  const halfWidth = k.width() / 2;
  const halfHeight = k.height() / 2;

  return {
    bottom: Math.min(
      map.height - 1,
      Math.ceil((camera.y + halfHeight) / map.tileheight),
    ),
    left: Math.max(0, Math.floor((camera.x - halfWidth) / map.tilewidth)),
    right: Math.min(
      map.width - 1,
      Math.ceil((camera.x + halfWidth) / map.tilewidth),
    ),
    top: Math.max(0, Math.floor((camera.y - halfHeight) / map.tileheight)),
  };
}

function drawLayerTiles(
  k: KAPLAYCtx,
  map: CampusTiledMap,
  layer: TiledTileLayer,
  tileset: RenderTileset,
): void {
  const bounds = visibleTileBounds(k, map);
  const offsetX = layer.offsetx ?? 0;
  const offsetY = layer.offsety ?? 0;
  const tileOffsetX = tileset.tileoffset?.x ?? 0;
  const tileOffsetY = tileset.tileoffset?.y ?? 0;

  for (let row = bounds.top; row <= bounds.bottom; row += 1) {
    for (let column = bounds.left; column <= bounds.right; column += 1) {
      const rawGid = layer.data[row * layer.width + column] ?? 0;
      if (rawGid === 0) continue;

      const tile = decodeTileGid(rawGid);
      if (tile.gid < tileset.firstgid || tile.gid > tileset.lastgid) {
        continue;
      }

      k.drawSprite({
        anchor: "center",
        angle: tile.angle,
        flipX: tile.flipX,
        flipY: tile.flipY,
        frame: tile.gid - tileset.firstgid,
        opacity: layer.opacity ?? 1,
        pos: k.vec2(
          column * map.tilewidth + map.tilewidth / 2 + offsetX + tileOffsetX,
          row * map.tileheight +
            map.tileheight -
            tileset.tileheight / 2 +
            offsetY +
            tileOffsetY,
        ),
        sprite: tileset.spriteName,
      });
    }
  }
}

export function addMapBand(
  k: KAPLAYCtx,
  loaded: LoadedCampusMap,
  layers: TiledTileLayer[],
  tilesets: RenderTileset[],
  layerName: "above" | "below",
  onDraw?: () => void,
): void {
  k.add([
    k.layer(layerName),
    {
      draw() {
        for (const tileset of tilesets) {
          for (const layer of layers) {
            drawLayerTiles(k, loaded.map, layer, tileset);
          }
        }
        onDraw?.();
      },
    },
  ]);
}
