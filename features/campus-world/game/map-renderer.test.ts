import { describe, expect, it, vi } from "vitest";

import {
  addFakeBand,
  renderTilesets,
  squareLayer,
} from "../testing/fake-kaplay-band";

const tilesets = renderTilesets(["grounds", "terrains"]);

function canvasAt(
  band: ReturnType<typeof addFakeBand>,
  position: { x: number; y: number },
) {
  const quad = band
    .quads()
    .find(({ pos }) => pos.x === position.x && pos.y === position.y);
  return band.canvases().find(({ fb }) => fb.tex === quad?.tex);
}

describe("addMapBand", () => {
  it("draws a lower layer before an upper layer from an earlier tileset", () => {
    const band = addFakeBand(
      [squareLayer([11, 0, 0, 0]), squareLayer([1, 0, 0, 0])],
      tilesets,
    );

    expect(band.drawFrame()).toEqual(["terrains", "grounds"]);
  });

  it("bakes each tile once, then draws the band from its chunk textures", () => {
    const band = addFakeBand(
      [squareLayer([1, 11, 0, 2]), squareLayer([0, 0, 12, 0])],
      tilesets,
    );

    expect(band.drawFrame()).toHaveLength(4);
    expect(band.drawFrame()).toEqual([]);
    expect(band.quads()).toHaveLength(1);
  });

  it("bakes a tall tile into every chunk its art reaches", () => {
    const band = addFakeBand(
      [squareLayer([0, 0, 0, 0, 0, 0, 1, 0, 0])],
      [{ ...tilesets[0]!, tileheight: 46 }],
      { chunkSize: 32 },
    );

    band.drawFrame();

    expect(
      band.canvases().map(({ draws, height, width }) => ({
        height,
        sprites: draws.map(({ sprite }) => sprite),
        width,
      })),
    ).toEqual([
      { height: 32, sprites: ["grounds"], width: 32 },
      { height: 16, sprites: ["grounds"], width: 32 },
    ]);
  });

  it("bakes each tile at its texel in the chunk, whatever the camera", () => {
    const data = Array<number>(16).fill(0);
    data[11] = 1;
    const band = addFakeBand([squareLayer(data)], tilesets, {
      camera: { x: 40, y: 24 },
      chunkSize: 32,
    });

    band.drawFrame();

    expect(canvasAt(band, { x: 32, y: 32 })?.draws).toEqual([
      {
        footprint: { height: 16, width: 16 },
        sprite: "grounds",
        texel: { x: 24, y: 8 },
        world: { x: 56, y: 40 },
      },
    ]);
  });

  it("bakes a rotated tile at its own size on a wide canvas", () => {
    const rotatedQuarterTurn = 0xa0_00_00_01;
    const band = addFakeBand(
      [squareLayer([rotatedQuarterTurn, 0, 0, 0])],
      tilesets,
      { chunkSize: 32, viewport: { height: 32, width: 64 } },
    );

    band.drawFrame();

    expect(band.canvases()[0]?.draws[0]?.footprint).toEqual({
      height: expect.closeTo(16),
      width: expect.closeTo(16),
    });
  });

  it("restores the game size after baking", () => {
    const band = addFakeBand([squareLayer([1, 1, 1, 1])], tilesets, {
      chunkSize: 16,
      viewport: { height: 32, width: 64 },
    });

    band.drawFrame();

    expect(band.gameSize()).toEqual({ height: 32, width: 64 });
  });

  it("draws each chunk upright at its world position", () => {
    const band = addFakeBand([squareLayer([1, 1, 1, 1])], tilesets, {
      chunkSize: 16,
    });

    band.drawFrame();

    expect(band.quads()).toEqual(
      [
        { x: 0, y: 0 },
        { x: 16, y: 0 },
        { x: 0, y: 16 },
        { x: 16, y: 16 },
      ].map((pos, index) => ({
        flipY: true,
        height: 16,
        pos,
        tex: `chunk-${index}`,
        width: 16,
      })),
    );
  });

  it("draws only the chunks a zoomed-in view reaches", () => {
    const band = addFakeBand([squareLayer(Array(25).fill(1))], tilesets, {
      camera: { x: 40, y: 40 },
      chunkSize: 32,
      scale: 2,
      viewport: { height: 32, width: 32 },
    });

    band.drawFrame();

    expect(band.quads().map(({ pos }) => pos)).toEqual([{ x: 32, y: 32 }]);
  });

  it("skips chunks with no tiles", () => {
    const data = Array<number>(16).fill(0);
    data[0] = 1;
    const band = addFakeBand([squareLayer(data)], tilesets, { chunkSize: 32 });

    band.drawFrame();

    expect(band.makeCanvas).toHaveBeenCalledOnce();
    expect(band.quads().map(({ pos }) => pos)).toEqual([{ x: 0, y: 0 }]);
  });

  it("bakes nothing for an empty band and still reports its draw", () => {
    const onDraw = vi.fn();
    const band = addFakeBand([], tilesets, { onDraw });

    band.drawFrame();

    expect(band.makeCanvas).not.toHaveBeenCalled();
    expect(band.quads()).toEqual([]);
    expect(onDraw).toHaveBeenCalledOnce();
  });

  it("frees every chunk texture when the band is destroyed", () => {
    const band = addFakeBand([squareLayer([1, 1, 1, 1])], tilesets, {
      chunkSize: 16,
    });
    band.drawFrame();

    band.destroy();

    expect(band.canvases()).toHaveLength(4);
    band.canvases().forEach(({ free }) => expect(free).toHaveBeenCalledOnce());
  });
});
