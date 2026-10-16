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

import { parseCampusTiledMap } from "../../schemas/campus-map.schema";
import { CampusMapError } from "./campus-map-error";
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

export const ENTRY_MAP: MapSource = { kind: "entry" };

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

interface SanitySource {
  dataset: string;
  projectId: string;
}

interface LoadCampusMapDependencies extends SanitySource {
  fetch: typeof fetch;
  onStageChange?: (stage: "manifest" | "map") => void;
  signal?: AbortSignal;
}

const SANITY_CDN_ORIGIN = "https://cdn.sanity.io";
const SANITY_ASSET_KINDS = ["files", "images"] as const;

export function sanityMapOrigins(projectId: string | undefined): string[] {
  return projectId
    ? [`https://${projectId}.api.sanity.io`, SANITY_CDN_ORIGIN]
    : [];
}

function isDatasetAsset(
  url: string,
  { dataset, projectId }: SanitySource,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return (
    parsed.origin === SANITY_CDN_ORIGIN &&
    SANITY_ASSET_KINDS.some((kind) =>
      parsed.pathname.startsWith(`/${kind}/${projectId}/${dataset}/`),
    )
  );
}

function assertDatasetAssets(
  manifest: WorldMapManifest,
  source: SanitySource,
): void {
  const urls = [manifest.mapUrl, ...manifest.tilesets.map(({ url }) => url)];

  if (!urls.every((url) => isDatasetAsset(url, source))) {
    throw new CampusMapError(
      "manifest",
      "The published campus map links to assets outside its dataset.",
    );
  }
}

function readCampusTiledMap(value: unknown): CampusTiledMap {
  const map = parseCampusTiledMap(value);

  if (!map) {
    throw new CampusMapError(
      "layout",
      "The published campus map has tile data the renderer cannot draw.",
    );
  }

  return map;
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
      throw new CampusMapError(
        "network",
        "The campus map request could not reach the server.",
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new CampusMapError(
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
    throw new CampusMapError(
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
    assertDatasetAssets(manifest, dependencies);
    dependencies.onStageChange?.("map");
    const published = await loadPublishedMap(manifest, { fetch });
    const map = readCampusTiledMap(published);
    // The parsed map drops object layers; readMapLayout validates those itself.
    const layout = readMapLayout(
      published as Parameters<typeof readMapLayout>[0],
    );

    return {
      bands: splitLayerBands(map),
      layout,
      manifest,
      map,
      tilesets: buildTilesetFrameTables(map.tilesets),
    };
  } catch (error) {
    dependencies.signal?.throwIfAborted();

    if (error instanceof CampusMapError) {
      throw error.mapId === null && mapId !== null
        ? new CampusMapError(error.kind, error.message, {
            cause: error,
            mapId,
          })
        : error;
    }

    if (error instanceof LayoutError) {
      throw new CampusMapError("layout", error.message, {
        cause: error,
        mapId,
      });
    }

    if (error instanceof ManifestError) {
      throw new CampusMapError("manifest", error.message, {
        cause: error,
        mapId,
      });
    }

    throw new CampusMapError(
      "manifest",
      "The published campus map could not be read.",
      { cause: error, mapId },
    );
  }
}
