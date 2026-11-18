import { describe, expect, it } from "vitest";

import { buildTilesetFrames, decodeTileGid } from "./tile-frames";

const FLIPPED_HORIZONTALLY = 0x80000000;
const FLIPPED_VERTICALLY = 0x40000000;
const FLIPPED_DIAGONALLY = 0x20000000;
const ROTATED_HEXAGONAL_120 = 0x10000000;

describe("buildTilesetFrames", () => {
  it("uses image fractions for the odd-size trees sheet", () => {
    const frames = buildTilesetFrames({
      columns: 15,
      imageheight: 605,
      imagewidth: 480,
      margin: 0,
      spacing: 0,
      tilecount: 270,
      tileheight: 32,
      tilewidth: 32,
    });

    expect(frames).toHaveLength(270);
    expect(frames[0]).toEqual({
      h: 32 / 605,
      w: 32 / 480,
      x: 0,
      y: 0,
    });
    expect(frames[269]).toEqual({
      h: 32 / 605,
      w: 32 / 480,
      x: 448 / 480,
      y: 544 / 605,
    });
  });

  it("includes tileset margins and spacing", () => {
    expect(
      buildTilesetFrames({
        columns: 2,
        imageheight: 22,
        imagewidth: 22,
        margin: 1,
        spacing: 2,
        tilecount: 4,
        tileheight: 8,
        tilewidth: 8,
      }),
    ).toEqual([
      { h: 8 / 22, w: 8 / 22, x: 1 / 22, y: 1 / 22 },
      { h: 8 / 22, w: 8 / 22, x: 11 / 22, y: 1 / 22 },
      { h: 8 / 22, w: 8 / 22, x: 1 / 22, y: 11 / 22 },
      { h: 8 / 22, w: 8 / 22, x: 11 / 22, y: 11 / 22 },
    ]);
  });
});

describe("decodeTileGid", () => {
  it.each([
    ["none", 0, { angle: 0, flipX: false, flipY: false }],
    [
      "horizontal",
      FLIPPED_HORIZONTALLY,
      { angle: 0, flipX: true, flipY: false },
    ],
    ["vertical", FLIPPED_VERTICALLY, { angle: 0, flipX: false, flipY: true }],
    [
      "horizontal and vertical",
      FLIPPED_HORIZONTALLY | FLIPPED_VERTICALLY,
      { angle: 0, flipX: true, flipY: true },
    ],
    ["diagonal", FLIPPED_DIAGONALLY, { angle: 270, flipX: true, flipY: false }],
    [
      "diagonal and horizontal",
      FLIPPED_DIAGONALLY | FLIPPED_HORIZONTALLY,
      { angle: 90, flipX: false, flipY: false },
    ],
    [
      "diagonal and vertical",
      FLIPPED_DIAGONALLY | FLIPPED_VERTICALLY,
      { angle: 270, flipX: false, flipY: false },
    ],
    [
      "all flips",
      FLIPPED_DIAGONALLY | FLIPPED_HORIZONTALLY | FLIPPED_VERTICALLY,
      { angle: 90, flipX: true, flipY: false },
    ],
  ])("decodes %s", (_, flags, transform) => {
    expect(decodeTileGid((42 | flags) >>> 0)).toEqual({
      gid: 42,
      ...transform,
    });
  });

  it("clears the fourth Tiled transform bit from orthogonal maps", () => {
    expect(decodeTileGid(42 | ROTATED_HEXAGONAL_120)).toEqual({
      angle: 0,
      flipX: false,
      flipY: false,
      gid: 42,
    });
  });
});
