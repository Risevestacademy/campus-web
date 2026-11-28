import type { Bounds } from "campus-world-map";

import type {
  EntryMapRecord,
  MapSyncMap,
  MapSyncResult,
  PublishedEntryMap,
  SpaceSettings,
} from "../types/maps.types";

// `not-synced`: drawn on the published map, with no row in the campus yet, so
// there is nothing to set up until a sync adds it.
export type SpaceState = "set-up" | "needs-kind" | "not-synced";
export type MapChange = "added" | "restored";

export interface ViewSpace {
  key: string;
  name: string;
  bounds: Bounds;
  state: SpaceState;
  change: MapChange | null;
  settings: SpaceSettings | null;
}

export interface ViewDesk {
  key: string;
  x: number;
  y: number;
  change: MapChange | null;
}

export interface LeavingSpace {
  key: string;
  name: string;
}

export interface MapView {
  spaces: ViewSpace[];
  desks: ViewDesk[];
  leavingSpaces: LeavingSpace[];
  leavingDesks: string[];
  needsKind: number;
}

// Where the entry map stands between Sanity, the campus and world:
// - `not-in-campus`: campus-api holds no live entry map with this key.
// - `unknown`: no sync has recorded a version since versions were kept.
// - `sanity-ahead`: Sanity holds a newer version than the last sync read.
// - `not-published`: the last sync is not live yet.
// - `live`: world was last told to load the version the campus holds.
export type MapVersionState =
  "not-in-campus" | "unknown" | "sanity-ahead" | "not-published" | "live";

export function mapVersionState(
  map: Pick<PublishedEntryMap, "mapKey" | "version">,
  record: EntryMapRecord | null,
): MapVersionState {
  if (record?.key !== map.mapKey) return "not-in-campus";
  if (record.syncedVersion === null) return "unknown";
  if (record.syncedVersion !== map.version) return "sanity-ahead";
  return record.publishedVersion === record.syncedVersion
    ? "live"
    : "not-published";
}

// Publishing tells world to load whatever Sanity holds at that moment, so it
// is offered only once the campus holds that same version.
export function canPublish(state: MapVersionState): boolean {
  return state === "not-published" || state === "live";
}

export function entrySyncOf(
  result: MapSyncResult | undefined,
  mapKey: string,
): MapSyncMap | undefined {
  return result?.maps.find((map) => map.isEntry && map.key === mapKey);
}

export function buildMapView(
  map: PublishedEntryMap,
  rows: readonly SpaceSettings[],
  sync: MapSyncMap | undefined,
): MapView {
  const drawnKeys = new Set(map.spaces.map(({ key }) => key));
  // The rows are the entry map's own; its default space is the tiles inside
  // no drawn one, so it has no shape here.
  const entryRows = rows.filter((row) => !row.isMapDefault);
  const rowsByKey = new Map(entryRows.map((row) => [row.key, row]));

  const added = new Set(sync?.spaces.added.map(({ key }) => key));
  const restored = new Set(sync?.spaces.restored);
  const addedDesks = new Set(sync?.desks.added);
  const restoredDesks = new Set(sync?.desks.restored);

  const spaces = map.spaces.map((shape): ViewSpace => {
    const settings = rowsByKey.get(shape.key) ?? null;
    return {
      key: shape.key,
      name: settings?.name ?? shape.name,
      bounds: shape.bounds,
      state: !settings
        ? "not-synced"
        : settings.kind === null
          ? "needs-kind"
          : "set-up",
      change: added.has(shape.key)
        ? "added"
        : restored.has(shape.key)
          ? "restored"
          : null,
      settings,
    };
  });

  const desks = map.desks.map((desk): ViewDesk => ({
    ...desk,
    change: addedDesks.has(desk.key)
      ? "added"
      : restoredDesks.has(desk.key)
        ? "restored"
        : null,
  }));

  // Before a sync has been looked at, a live row the published map no longer
  // draws is one the next sync retires.
  const leavingKeys = sync
    ? sync.spaces.retired
    : entryRows.filter(({ key }) => !drawnKeys.has(key)).map(({ key }) => key);
  return {
    spaces,
    desks,
    leavingSpaces: leavingKeys.map((key) => ({
      key,
      name: rowsByKey.get(key)?.name ?? key,
    })),
    leavingDesks: sync?.desks.retired ?? [],
    needsKind: spaces.filter(({ state }) => state === "needs-kind").length,
  };
}
