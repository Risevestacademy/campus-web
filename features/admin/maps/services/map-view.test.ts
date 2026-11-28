import { describe, expect, it } from "vitest";

import type {
  EntryMapRecord,
  MapSyncMap,
  PublishedEntryMap,
  SpaceSettings,
} from "../types/maps.types";
import {
  buildMapView,
  canPublish,
  entrySyncOf,
  mapVersionState,
} from "./map-view";

const ENTRY = "map-entry";

function rect(x: number, y: number) {
  return { shape: "rect" as const, x, y, width: 4, height: 4 };
}

const map: PublishedEntryMap = {
  mapKey: "campus",
  version: "v2",
  widthTiles: 40,
  heightTiles: 26,
  spaces: [
    { key: "town_hall", name: "town_hall", bounds: rect(1, 1) },
    { key: "library", name: "library", bounds: rect(6, 1) },
    { key: "room_space_1", name: "room_space_1", bounds: rect(11, 1) },
  ],
  desks: [
    { key: "desk_a1", x: 2, y: 8 },
    { key: "desk_c1", x: 4, y: 8 },
  ],
  walls: [],
};

function row(
  key: string,
  overrides: Partial<SpaceSettings> = {},
): SpaceSettings {
  return {
    id: `id-${key}`,
    mapId: ENTRY,
    key,
    name: key,
    kind: "classroom",
    access: "normal",
    audioMode: "boundary",
    capacity: null,
    isMapDefault: false,
    ...overrides,
  };
}

const sync: MapSyncMap = {
  outcome: "updated",
  key: "campus",
  isEntry: true,
  spaces: {
    added: [{ key: "library", name: "Library", kind: "classroom" }],
    restored: [],
    retired: ["old-lab"],
    needsKind: [],
  },
  desks: { added: ["desk_a1"], restored: [], retired: ["desk_b4"] },
};

describe("mapVersionState", () => {
  const sanity = { mapKey: "campus", version: "v2" };
  function record(overrides: Partial<EntryMapRecord> = {}): EntryMapRecord {
    return {
      id: ENTRY,
      key: "campus",
      name: "Campus",
      syncedVersion: "v2",
      publishedVersion: "v2",
      ...overrides,
    };
  }

  it.each([
    ["no entry map is held", null, "not-in-campus"],
    [
      "the held entry map is another",
      record({ key: "annex" }),
      "not-in-campus",
    ],
    [
      "no sync has recorded a version",
      record({ syncedVersion: null, publishedVersion: null }),
      "unknown",
    ],
    [
      "Sanity is newer than the last sync",
      record({ syncedVersion: "v1" }),
      "sanity-ahead",
    ],
    [
      "the last sync is not live",
      record({ publishedVersion: "v1" }),
      "not-published",
    ],
    [
      "it was never published",
      record({ publishedVersion: null }),
      "not-published",
    ],
    ["world loads what the campus holds", record(), "live"],
  ] as const)("is %2$s when %1$s", (_label, entry, state) => {
    expect(mapVersionState(sanity, entry)).toBe(state);
  });

  it("offers Publish only once the campus holds what Sanity serves", () => {
    expect(canPublish("not-published")).toBe(true);
    expect(canPublish("live")).toBe(true);
    expect(canPublish("sanity-ahead")).toBe(false);
    expect(canPublish("unknown")).toBe(false);
    expect(canPublish("not-in-campus")).toBe(false);
  });
});

describe("entrySyncOf", () => {
  it("takes the entry map for this key only", () => {
    const result = { dryRun: true, changed: true, maps: [sync] };

    expect(entrySyncOf(result, "campus")).toBe(sync);
    expect(entrySyncOf(result, "annex")).toBeUndefined();
    expect(entrySyncOf(undefined, "campus")).toBeUndefined();
  });
});

describe("buildMapView", () => {
  it("sets each drawn space's state from its row", () => {
    const view = buildMapView(
      map,
      [row("town_hall", { name: "Town Hall" }), row("library", { kind: null })],
      undefined,
    );

    expect(
      view.spaces.map(({ key, name, state }) => ({ key, name, state })),
    ).toEqual([
      { key: "town_hall", name: "Town Hall", state: "set-up" },
      { key: "library", name: "library", state: "needs-kind" },
      { key: "room_space_1", name: "room_space_1", state: "not-synced" },
    ]);
    expect(view.needsKind).toBe(1);
  });

  it("marks what a sync adds and lists what it retires", () => {
    const view = buildMapView(map, [row("town_hall")], sync);

    expect(view.spaces.find(({ key }) => key === "library")?.change).toBe(
      "added",
    );
    expect(view.desks).toEqual([
      { key: "desk_a1", x: 2, y: 8, change: "added" },
      { key: "desk_c1", x: 4, y: 8, change: null },
    ]);
    expect(view.leavingSpaces).toEqual([{ key: "old-lab", name: "old-lab" }]);
    expect(view.leavingDesks).toEqual(["desk_b4"]);
  });

  it("lists a row the map no longer draws before any sync is previewed", () => {
    const view = buildMapView(
      map,
      [row("town_hall"), row("library"), row("old-lab", { name: "Old Lab" })],
      undefined,
    );

    expect(view.leavingSpaces).toEqual([{ key: "old-lab", name: "Old Lab" }]);
  });
});
