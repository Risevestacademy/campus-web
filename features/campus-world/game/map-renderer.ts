import type { DrawSpriteOpt, KAPLAYCtx } from "kaplay";

import { buildBandDrawList } from "../services/map/band-draw-list";
import type { TiledTileLayer } from "../services/map/layer-bands";
import type {
  CampusTiledMap,
  LoadedCampusMap,
} from "../services/map/load-campus-map";

export interface RenderTileset {
  firstgid: number;
  lastgid: number;
  name: string;
  spriteName: string;
  tileheight: number;
  tileoffset?: { x?: number; y?: number };
  tilewidth: number;
}

interface LayerSprites {
  cells: Array<DrawSpriteOpt | undefined>;
  width: number;
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

function layerSprites(
  k: KAPLAYCtx,
  map: CampusTiledMap,
  layers: TiledTileLayer[],
  tilesets: RenderTileset[],
): LayerSprites[] {
  return buildBandDrawList(map, layers, tilesets).map(({ cells, width }) => ({
    cells: cells.map(
      (tile): DrawSpriteOpt | undefined =>
        tile && {
          anchor: "center",
          angle: tile.angle,
          flipX: tile.flipX,
          flipY: tile.flipY,
          frame: tile.frame,
          opacity: tile.opacity,
          pos: k.vec2(tile.x, tile.y),
          sprite: tilesets[tile.tileset]!.spriteName,
        },
    ),
    width,
  }));
}

export function addMapBand(
  k: KAPLAYCtx,
  loaded: LoadedCampusMap,
  layers: TiledTileLayer[],
  tilesets: RenderTileset[],
  layerName: "above" | "below",
  onDraw?: () => void,
): void {
  const sprites = layerSprites(k, loaded.map, layers, tilesets);

  k.add([
    k.layer(layerName),
    {
      draw() {
        const bounds = visibleTileBounds(k, loaded.map);

        for (const { cells, width } of sprites) {
          for (let row = bounds.top; row <= bounds.bottom; row += 1) {
            for (
              let column = bounds.left;
              column <= bounds.right;
              column += 1
            ) {
              const sprite = cells[row * width + column];
              if (sprite) k.drawSprite(sprite);
            }
          }
        }
        onDraw?.();
      },
    },
  ]);
}
