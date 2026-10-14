import { describe, expect, it } from "vitest";

import { buildBandDrawList } from "./band-draw-list";
import type { TiledTileLayer } from "./layer-bands";

const FLIPPED_HORIZONTALLY = 0x80000000;

const map = { tileheight: 16, tilewidth: 16 };
const tilesets = [
  { firstgid: 1, lastgid: 4, tileheight: 16 },
  { firstgid: 5, lastgid: 8, tileheight: 32, tileoffset: { x: 2, y: -4 } },
];

function layer(data: number[], extra: Partial<TiledTileLayer> = {}) {
  return {
    data,
    height: 1,
    type: "tilelayer",
    width: data.length,
    ...extra,
  } satisfies TiledTileLayer;
}

describe("buildBandDrawList", () => {
  it("resolves each tile to its tileset frame, transform, and world position", () => {
    const [draws] = buildBandDrawList(
      map,
      [
        layer([0, (6 | FLIPPED_HORIZONTALLY) >>> 0], {
          offsetx: 1,
          offsety: 3,
          opacity: 0.5,
        }),
      ],
      tilesets,
    );

    expect(draws?.width).toBe(2);
    expect(draws?.cells).toEqual([
      undefined,
      {
        angle: 0,
        flipX: true,
        flipY: false,
        frame: 1,
        opacity: 0.5,
        tileset: 1,
        x: 27,
        y: -1,
      },
    ]);
  });

  it("keeps one draw list per layer in band order", () => {
    const draws = buildBandDrawList(map, [layer([5]), layer([1])], tilesets);

    expect(draws.map(({ cells }) => cells[0]?.tileset)).toEqual([1, 0]);
  });

  it("skips a gid that no tileset owns", () => {
    const [draws] = buildBandDrawList(map, [layer([99])], tilesets);

    expect(draws?.cells).toEqual([undefined]);
  });
});
