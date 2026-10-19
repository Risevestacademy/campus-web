import type { Canvas, DrawSpriteOpt, GameObj, KAPLAYCtx } from "kaplay";

import { visibleArea, worldSize } from "../services/camera";
import { buildBandDrawList } from "../services/map/band-draw-list";
import type { TiledTileLayer } from "../services/map/layer-bands";
import type { CampusTiledMap } from "../services/map/load-campus-map";
import {
  chunkInView,
  chunkView,
  type MapChunk,
  mapChunks,
  type WorldView,
} from "../services/map/map-chunks";
import {
  createTileViewportCuller,
  type TileBounds,
} from "../services/viewport-culling";

// Every reported device takes a 4096 texture; 1024 wastes the least at the
// map's ragged edges and keeps each bake allocation small.
export const MAP_CHUNK_SIZE = 1024;

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

interface MapBand {
  chunkSize?: number;
  layer: "above" | "below";
  layers: TiledTileLayer[];
  map: CampusTiledMap;
  onDraw?: () => void;
  tilesets: RenderTileset[];
}

interface BakedChunk extends MapChunk {
  canvas: Canvas;
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
          // The bake draws in chunk space; the camera must not apply.
          fixed: true,
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

function tilesIn(sprites: LayerSprites[], bounds: TileBounds): DrawSpriteOpt[] {
  const tiles: DrawSpriteOpt[] = [];
  for (const { cells, width } of sprites) {
    for (let row = bounds.top; row <= bounds.bottom; row += 1) {
      for (let column = bounds.left; column <= bounds.right; column += 1) {
        const tile = cells[row * width + column];
        if (tile) tiles.push(tile);
      }
    }
  }
  return tiles;
}

// Canvas.draw maps points through the game's size, not the canvas's: the
// scale makes one unit one texel of the chunk.
function bakeChunk(
  k: KAPLAYCtx,
  chunk: MapChunk,
  tiles: DrawSpriteOpt[],
): Canvas {
  const canvas = k.makeCanvas(chunk.width, chunk.height);
  canvas.draw(() => {
    k.pushTransform();
    k.pushMatrix(new k.Mat4());
    k.pushScale(k.width() / chunk.width, k.height() / chunk.height);
    k.pushTranslate(-chunk.x, -chunk.y);
    tiles.forEach((tile) => k.drawSprite(tile));
    k.popTransform();
  });
  return canvas;
}

function bakeBand(
  k: KAPLAYCtx,
  { chunkSize = MAP_CHUNK_SIZE, layers, map, tilesets }: MapBand,
): BakedChunk[] {
  const sprites = layerSprites(k, map, layers, tilesets);
  const tileBounds = createTileViewportCuller({ layers, map, tilesets });

  return mapChunks(worldSize(map), chunkSize).flatMap((chunk) => {
    const tiles = tilesIn(sprites, tileBounds(chunkView(chunk)));
    return tiles.length > 0
      ? [{ ...chunk, canvas: bakeChunk(k, chunk, tiles) }]
      : [];
  });
}

// Framebuffer textures are stored bottom row first.
function drawChunk(k: KAPLAYCtx, { canvas, height, width, x, y }: BakedChunk) {
  k.drawUVQuad({
    flipY: true,
    height,
    pos: k.vec2(x, y),
    tex: canvas.fb.tex,
    width,
  });
}

function cameraView(k: KAPLAYCtx): WorldView {
  const camera = k.getCamPos();
  return {
    ...visibleArea({ height: k.height(), width: k.width() }, k.getCamScale().x),
    x: camera.x,
    y: camera.y,
  };
}

function hasSize(k: KAPLAYCtx): boolean {
  return k.width() > 0 && k.height() > 0;
}

export function addMapBand(k: KAPLAYCtx, band: MapBand): GameObj {
  let chunks: BakedChunk[] | undefined;

  return k.add([
    k.layer(band.layer),
    {
      destroy() {
        chunks?.forEach(({ canvas }) => canvas.free());
      },
      draw() {
        // A bake on an unsized canvas scales every tile to nothing, for good.
        if (!chunks && !hasSize(k)) return;
        chunks ??= bakeBand(k, band);

        const view = cameraView(k);
        chunks
          .filter((chunk) => chunkInView(chunk, view))
          .forEach((chunk) => drawChunk(k, chunk));
        band.onDraw?.();
      },
    },
  ]);
}
