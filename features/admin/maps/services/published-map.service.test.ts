import type { Bounds } from "campus-world-map";
import { describe, expect, it, vi } from "vitest";

import { mergeWalls, readPublishedEntryMap } from "./published-map.service";

const TILE = 32;
const source = { dataset: "staging", projectId: "sj3zsz66" };
const mapUrl = "https://cdn.sanity.io/files/sj3zsz66/staging/map.json";

function objectLayer(name: string, objects: Record<string, unknown>[]) {
  return {
    type: "objectgroup",
    name,
    objects: objects.map((object, index) => ({ id: index + 1, ...object })),
  };
}

const tiledMap = {
  width: 10,
  height: 6,
  tilewidth: TILE,
  tileheight: TILE,
  tilesets: [],
  layers: [
    objectLayer("collisions", [{ x: 0, y: 0, width: 10 * TILE, height: TILE }]),
    objectLayer("spawn", [
      { name: "spawn", x: TILE, y: 3 * TILE, point: true },
    ]),
    objectLayer("spaces", [
      {
        name: "library",
        class: "classroom",
        x: TILE,
        y: TILE,
        width: 4 * TILE,
        height: 3 * TILE,
        properties: [{ name: "name", type: "string", value: "Library" }],
      },
      {
        name: "studio",
        x: 6 * TILE,
        y: TILE,
        polygon: [
          { x: 0, y: 0 },
          { x: 3 * TILE, y: 0 },
          { x: 3 * TILE, y: 3 * TILE },
        ],
      },
    ]),
    objectLayer("desks", [
      { name: "desk_a1", x: 2 * TILE, y: 2 * TILE, point: true },
    ]),
  ],
};

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    mapId: "campus",
    version: "version-2",
    widthTiles: 10,
    heightTiles: 6,
    isEntry: true,
    mapUrl,
    tilesets: [],
    ...overrides,
  };
}

function stubFetch(manifests: unknown[], map: unknown = tiledMap) {
  return vi.fn(async (input: RequestInfo | URL) =>
    Response.json(String(input) === mapUrl ? map : { result: manifests }),
  ) as unknown as typeof fetch;
}

describe("readPublishedEntryMap", () => {
  it("reads the entry map down to its shapes, desks and walls", async () => {
    const fetch = stubFetch([
      manifest({ mapId: "annex", isEntry: false }),
      manifest(),
    ]);

    const read = await readPublishedEntryMap({ ...source, fetch });

    expect(read).toEqual({
      kind: "loaded",
      map: {
        mapKey: "campus",
        version: "version-2",
        widthTiles: 10,
        heightTiles: 6,
        spaces: [
          {
            key: "library",
            name: "Library",
            bounds: { shape: "rect", x: 1, y: 1, width: 4, height: 3 },
          },
          {
            key: "studio",
            name: "studio",
            bounds: {
              shape: "polygon",
              points: [
                { x: 6, y: 1 },
                { x: 9, y: 1 },
                { x: 9, y: 4 },
              ],
            },
          },
        ],
        desks: [{ key: "desk_a1", x: 2, y: 2 }],
        walls: [{ shape: "rect", x: 0, y: 0, width: 10, height: 1 }],
      },
    });
  });

  it("is not configured without a Sanity project", async () => {
    const fetch = stubFetch([manifest()]);

    expect(
      await readPublishedEntryMap({
        dataset: "staging",
        projectId: undefined,
        fetch,
      }),
    ).toEqual({ kind: "not-configured" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never fetches a map file outside the dataset", async () => {
    const foreign = "https://evil.example/files/sj3zsz66/staging/map.json";
    const fetch = stubFetch([manifest({ mapUrl: foreign })]);

    expect(await readPublishedEntryMap({ ...source, fetch })).toEqual({
      kind: "unavailable",
    });
    expect(
      vi.mocked(fetch).mock.calls.map(([url]) => String(url)),
    ).not.toContain(foreign);
  });

  it("is unavailable when no map is the entry map", async () => {
    const fetch = stubFetch([manifest({ isEntry: false })]);

    expect(await readPublishedEntryMap({ ...source, fetch })).toEqual({
      kind: "unavailable",
    });
  });

  it("is unavailable when the map's objects cannot be read", async () => {
    const broken = {
      ...tiledMap,
      layers: [objectLayer("spaces", [{ x: 0, y: 0, width: 32, height: 32 }])],
    };
    const fetch = stubFetch([manifest()], broken);

    expect(await readPublishedEntryMap({ ...source, fetch })).toEqual({
      kind: "unavailable",
    });
  });

  it("is unavailable when Sanity answers with an error", async () => {
    const fetch = vi.fn(async () =>
      Response.json({}, { status: 500 }),
    ) as unknown as typeof globalThis.fetch;

    expect(await readPublishedEntryMap({ ...source, fetch })).toEqual({
      kind: "unavailable",
    });
  });
});

describe("mergeWalls", () => {
  const tile = (x: number, y: number) =>
    ({ shape: "rect", x, y, width: 1, height: 1 }) as const;

  it("joins tiles that touch on a row, and only those", () => {
    expect(
      mergeWalls([tile(2, 0), tile(0, 0), tile(1, 0), tile(4, 0)]),
    ).toEqual([
      { shape: "rect", x: 0, y: 0, width: 3, height: 1 },
      { shape: "rect", x: 4, y: 0, width: 1, height: 1 },
    ]);
  });

  it("stacks tiles in a column, and rows only when they match", () => {
    expect(
      mergeWalls([
        tile(0, 0),
        tile(0, 1),
        tile(0, 2),
        tile(3, 0),
        tile(4, 0),
        tile(3, 1),
      ]),
    ).toEqual([
      { shape: "rect", x: 0, y: 0, width: 1, height: 3 },
      { shape: "rect", x: 3, y: 1, width: 1, height: 1 },
      { shape: "rect", x: 3, y: 0, width: 2, height: 1 },
    ]);
  });

  it("keeps polygons as they are", () => {
    const polygon: Bounds = {
      shape: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    };

    expect(mergeWalls([polygon, tile(0, 0)])).toEqual([tile(0, 0), polygon]);
  });
});
