import type { DrawSpriteOpt, GameObj, KAPLAYCtx } from "kaplay";

import { buildBandDrawList } from "../services/map/band-draw-list";
import type { TiledTileLayer } from "../services/map/layer-bands";
import type { CampusTiledMap } from "../services/map/load-campus-map";
import { createTileViewportCuller } from "../services/viewport-culling";

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

interface MapBand {
  layer: "above" | "below";
  layers: TiledTileLayer[];
  map: CampusTiledMap;
  onDraw?: () => void;
  tilesets: RenderTileset[];
}

export function addMapBand(
  k: KAPLAYCtx,
  { layer, layers, map, onDraw, tilesets }: MapBand,
): GameObj {
  const sprites = layerSprites(k, map, layers, tilesets);
  const visibleBounds = createTileViewportCuller({ layers, map, tilesets });

  return k.add([
    k.layer(layer),
    {
      draw() {
        const camera = k.getCamPos();
        const bounds = visibleBounds({
          height: k.height(),
          width: k.width(),
          x: camera.x,
          y: camera.y,
        });

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
