import { describe, expect, it } from "vitest";

import { chunkInView, chunkView, grownView, mapChunks } from "./map-chunks";

describe("mapChunks", () => {
  it("tiles the campus map into 1024 px chunks, cropped at the edge", () => {
    const chunks = mapChunks({ height: 3296, width: 5120 }, 1024);

    expect(chunks).toHaveLength(20);
    expect(chunks[0]).toEqual({ height: 1024, width: 1024, x: 0, y: 0 });
    expect(chunks.at(-1)).toEqual({
      height: 224,
      width: 1024,
      x: 4096,
      y: 3072,
    });
  });

  it("crops a column that does not fill a chunk", () => {
    expect(mapChunks({ height: 50, width: 100 }, 64)).toEqual([
      { height: 50, width: 64, x: 0, y: 0 },
      { height: 50, width: 36, x: 64, y: 0 },
    ]);
  });

  it("gives one chunk to a world smaller than a chunk", () => {
    expect(mapChunks({ height: 96, width: 128 }, 1024)).toEqual([
      { height: 96, width: 128, x: 0, y: 0 },
    ]);
  });
});

describe("chunkView", () => {
  it("centres the view on the chunk", () => {
    expect(chunkView({ height: 32, width: 64, x: 64, y: 32 })).toEqual({
      height: 32,
      width: 64,
      x: 96,
      y: 48,
    });
  });
});

describe("chunkInView", () => {
  const chunk = { height: 32, width: 32, x: 32, y: 32 };

  it.each([
    ["inside", { height: 16, width: 16, x: 48, y: 48 }, true],
    ["overlapping a corner", { height: 32, width: 32, x: 20, y: 20 }, true],
    ["touching the left edge", { height: 32, width: 32, x: 16, y: 48 }, false],
    [
      "touching the bottom edge",
      { height: 32, width: 32, x: 48, y: 80 },
      false,
    ],
    ["far away", { height: 32, width: 32, x: 400, y: 400 }, false],
    ["larger than the world", { height: 900, width: 900, x: 48, y: 48 }, true],
  ])("is %s: %o", (_, view, expected) => {
    expect(chunkInView(chunk, view)).toBe(expected);
  });
});

describe("grownView", () => {
  it("grows every side by the margin around the same centre", () => {
    expect(grownView({ height: 16, width: 32, x: 40, y: 24 }, 8)).toEqual({
      height: 32,
      width: 48,
      x: 40,
      y: 24,
    });
  });
});
