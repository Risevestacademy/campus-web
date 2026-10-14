import { describe, expect, it } from "vitest";

import mapFixture from "../services/map/fixtures/campus-trimmed.json";
import { parseCampusTiledMap } from "./campus-map.schema";

type Fixture = typeof mapFixture;

const [ground, furniture] = mapFixture.layers;

function withTileset(changes: Record<string, unknown>): Fixture {
  const [first, ...rest] = mapFixture.tilesets;
  return { ...mapFixture, tilesets: [{ ...first!, ...changes }, ...rest] };
}

function withGround(changes: Record<string, unknown>): unknown {
  const [, ...rest] = mapFixture.layers;
  return { ...mapFixture, layers: [{ ...ground!, ...changes }, ...rest] };
}

describe("parseCampusTiledMap", () => {
  it("reads the published map without the parts the renderer never draws", () => {
    const map = parseCampusTiledMap(mapFixture);

    expect(map?.tilesets).toHaveLength(3);
    expect(map?.layers.map((layer) => layer.type)).toEqual([
      "tilelayer",
      "group",
      "tilelayer",
      "objectgroup",
      "objectgroup",
    ]);
    expect(map?.layers[3]).toStrictEqual({
      type: "objectgroup",
      name: "collisions",
      visible: true,
    });
  });

  it.each([
    ["base64 tile data", { data: "eJxjYGBgAAAABAAB", encoding: "base64" }],
    ["chunked tile data from an infinite map", { data: undefined, chunks: [] }],
    ["tile data that does not fill the layer", { data: [1, 2, 3] }],
    ["a gid above 32 bits", { data: Array(12).fill(2 ** 32) }],
    ["opacity above 1", { opacity: 2 }],
    ["a layer type Tiled never writes", { type: "spritelayer" }],
  ])("rejects a tile layer with %s", (_, changes) => {
    expect(parseCampusTiledMap(withGround(changes))).toBeUndefined();
  });

  it("rejects a malformed tile layer nested in a group", () => {
    const [chairs, ...rest] = furniture!.layers!;
    const map = {
      ...mapFixture,
      layers: [
        ground,
        { ...furniture, layers: [{ ...chairs, data: "AAAA" }, ...rest] },
      ],
    };

    expect(parseCampusTiledMap(map)).toBeUndefined();
  });

  it.each([
    ["no columns", { columns: 0 }],
    ["no tiles", { tilecount: 0 }],
    ["a zero-width image", { imagewidth: 0 }],
    ["a text image height", { imageheight: "544" }],
    ["a negative first gid", { firstgid: -1 }],
    ["a fractional tile width", { tilewidth: 31.5 }],
    ["no image", { image: undefined }],
  ])("rejects a tileset with %s", (_, changes) => {
    expect(parseCampusTiledMap(withTileset(changes))).toBeUndefined();
  });

  it.each([null, "map", [], { ...mapFixture, tilewidth: 0 }])(
    "rejects %j as a map",
    (value) => {
      expect(parseCampusTiledMap(value)).toBeUndefined();
    },
  );
});
