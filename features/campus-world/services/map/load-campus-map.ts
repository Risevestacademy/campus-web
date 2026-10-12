import {
  fetchWorldMapManifest,
  fetchWorldMapManifests,
  LayoutError,
  loadPublishedMap,
  ManifestError,
  type MapLayout,
  readMapLayout,
  type WorldMapManifest,
} from "campus-world-map";

import {
  type LayerBands,
  splitLayerBands,
  type TiledLayer,
} from "./layer-bands";
import {
  buildTilesetFrameTables,
  type TiledTileset,
  type TilesetFrameTable,
} from "./tile-frames";

export type MapSource =
  { kind: "entry" } | { kind: "pinned"; mapId: string; version: string };

export type CampusMapLoadErrorKind = "layout" | "manifest" | "network";

export class CampusMapLoadError extends Error {
  readonly kind: CampusMapLoadErrorKind;
  readonly mapId: string | null;

  constructor(
    kind: CampusMapLoadErrorKind,
    message: string,
    options: { cause?: unknown; mapId?: string | null } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "CampusMapLoadError";
    this.kind = kind;
    this.mapId = options.mapId ?? null;
  }
}

export interface CampusTiledMap {
  height: number;
  layers: TiledLayer[];
  tileheight: number;
  tilesets: TiledTileset[];
  tilewidth: number;
  width: number;
}

export interface LoadedCampusMap {
  bands: LayerBands;
  layout: MapLayout;
  manifest: WorldMapManifest;
  map: CampusTiledMap;
  tilesets: TilesetFrameTable[];
}

interface LoadCampusMapDependencies {
  dataset: string;
  fetch: typeof fetch;
  onStageChange?: (stage: "manifest" | "map") => void;
  projectId: string;
  signal?: AbortSignal;
}

export function sanityMapOrigins(projectId: string | undefined): string[] {
  return projectId
    ? [`https://${projectId}.api.sanity.io`, "https://cdn.sanity.io"]
    : [];
}

function checkedFetch(
  fetchImplementation: typeof fetch,
  signal?: AbortSignal,
): typeof fetch {
  return async (input, init) => {
    let response: Response;

    try {
      response = await fetchImplementation(
        input,
        signal ? { ...init, signal } : init,
      );
    } catch (error) {
      signal?.throwIfAborted();
      throw new CampusMapLoadError(
        "network",
        "The campus map request could not reach the server.",
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new CampusMapLoadError(
        "network",
        `The campus map request answered ${response.status}.`,
      );
    }

    return response;
  };
}

async function loadManifest(
  source: MapSource,
  dependencies: LoadCampusMapDependencies,
  fetch: typeof globalThis.fetch,
): Promise<WorldMapManifest> {
  const connection = {
    dataset: dependencies.dataset,
    fetch,
    projectId: dependencies.projectId,
  };

  if (source.kind === "pinned") {
    return fetchWorldMapManifest({
      ...connection,
      mapId: source.mapId,
      useCdn: true,
      version: source.version,
    });
  }

  const manifests = await fetchWorldMapManifests(connection);
  const entry = manifests.find(({ isEntry }) => isEntry);

  if (!entry) {
    throw new CampusMapLoadError(
      "manifest",
      "No published entry map is available.",
    );
  }

  return entry;
}

export async function loadCampusMap(
  source: MapSource,
  dependencies: LoadCampusMapDependencies,
): Promise<LoadedCampusMap> {
  const fetch = checkedFetch(dependencies.fetch, dependencies.signal);
  let mapId = source.kind === "pinned" ? source.mapId : null;

  try {
    dependencies.signal?.throwIfAborted();
    dependencies.onStageChange?.("manifest");
    const manifest = await loadManifest(source, dependencies, fetch);
    mapId = manifest.mapId;
    dependencies.onStageChange?.("map");
    const map = await loadPublishedMap<CampusTiledMap>(manifest, { fetch });
    const layout = readMapLayout(map);

    return {
      bands: splitLayerBands(map),
      layout,
      manifest,
      map,
      tilesets: buildTilesetFrameTables(map.tilesets),
    };
  } catch (error) {
    dependencies.signal?.throwIfAborted();

    if (error instanceof CampusMapLoadError) {
      throw error.mapId === null && mapId !== null
        ? new CampusMapLoadError(error.kind, error.message, {
            cause: error,
            mapId,
          })
        : error;
    }

    if (error instanceof LayoutError) {
      throw new CampusMapLoadError("layout", error.message, {
        cause: error,
        mapId,
      });
    }

    if (error instanceof ManifestError) {
      throw new CampusMapLoadError("manifest", error.message, {
        cause: error,
        mapId,
      });
    }

    throw new CampusMapLoadError(
      "manifest",
      "The published campus map could not be read.",
      { cause: error, mapId },
    );
  }
}
