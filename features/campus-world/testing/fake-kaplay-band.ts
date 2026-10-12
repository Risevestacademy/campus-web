import type { KAPLAYCtx } from "kaplay";
import { vi } from "vitest";

import { addMapBand, type RenderTileset } from "../game/map-renderer";
import type { TiledTileLayer } from "../services/map/layer-bands";
import type { CampusTiledMap } from "../services/map/load-campus-map";

const TILE = 16;

export function renderTilesets(names: string[]): RenderTileset[] {
  return names.map((name, index) => ({
    firstgid: index * 10 + 1,
    lastgid: index * 10 + 10,
    name,
    spriteName: name,
    tileheight: TILE,
    tilewidth: TILE,
  }));
}

export function squareLayer(data: number[]): TiledTileLayer {
  const side = Math.sqrt(data.length);
  return { data, height: side, type: "tilelayer", width: side };
}

export function addFakeBand(
  layers: TiledTileLayer[],
  tilesets: RenderTileset[],
) {
  const side = layers[0]?.width ?? 1;
  const drawn: string[] = [];
  let draw: (() => void) | undefined;
  const drawSprite = vi.fn((options: { sprite: string }) => {
    drawn.push(options.sprite);
  });
  const k = {
    add: (components: Array<{ draw?: () => void }>) => {
      draw = components.find((component) => component.draw)?.draw;
    },
    drawSprite,
    getCamPos: () => ({ x: (side * TILE) / 2, y: (side * TILE) / 2 }),
    height: () => side * TILE,
    layer: (name: string) => ({ name }),
    vec2: (x: number, y: number) => ({ x, y }),
    width: () => side * TILE,
  } as unknown as KAPLAYCtx;
  const map: CampusTiledMap = {
    height: side,
    layers,
    tileheight: TILE,
    tilesets: [],
    tilewidth: TILE,
    width: side,
  };

  addMapBand(k, { layer: "below", layers, map, tilesets });

  return {
    drawFrame() {
      drawn.length = 0;
      draw?.();
      return [...drawn];
    },
    drawSprite,
  };
}
