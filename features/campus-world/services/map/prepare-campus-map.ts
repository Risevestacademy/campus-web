import { startTimer } from "../timer";
import { CampusMapError } from "./campus-map-error";
import {
  loadCampusMap,
  type LoadedCampusMap,
  type MapSource,
} from "./load-campus-map";
import type { TilesetFrameTable } from "./tile-frames";

export type CampusMapModule = typeof import("kaplay");

export type CampusMapIdentity = Pick<
  LoadedCampusMap["manifest"],
  "mapId" | "version"
>;

export type CampusMapPreparationProgress =
  | { stage: "manifest" }
  | { stage: "map" }
  | { completed: number; stage: "tilesets"; total: number }
  | { stage: "runtime"; total: number };

export interface PreparedTileset extends TilesetFrameTable {
  decodedImage?: ImageBitmap;
}

export interface PreparedCampusMap extends Omit<LoadedCampusMap, "tilesets"> {
  kaplayModule: CampusMapModule;
  preparationMs: number;
  tilesets: PreparedTileset[];
}

export interface PrepareCampusMapDependencies {
  dataset: string;
  fetch: typeof globalThis.fetch;
  loadImage: (url: string, signal: AbortSignal) => Promise<ImageBitmap>;
  loadKaplay: () => Promise<CampusMapModule>;
  now?: () => number;
  onProgress?: (progress: CampusMapPreparationProgress) => void;
  projectId: string;
  signal: AbortSignal;
}

export async function loadDecodedCampusMapImage(
  url: string,
  dependencies: {
    fetch: typeof globalThis.fetch;
    signal: AbortSignal;
  },
): Promise<ImageBitmap> {
  const response = await dependencies.fetch.call(globalThis, url, {
    signal: dependencies.signal,
  });

  if (!response.ok) {
    throw new Error(`The campus tileset request answered ${response.status}.`);
  }

  const image = await createImageBitmap(await response.blob());

  if (dependencies.signal.aborted) {
    image.close();
    dependencies.signal.throwIfAborted();
  }

  return image;
}

export function isPreparedCampusMapRenderReady(
  prepared: PreparedCampusMap,
  holdsMap: (map: CampusMapIdentity) => boolean,
): boolean {
  return (
    holdsMap(prepared.manifest) ||
    prepared.tilesets.every(({ decodedImage }) => decodedImage !== undefined)
  );
}

export function takePreparedTilesetImages(
  prepared: PreparedCampusMap,
): Array<ImageBitmap | undefined> {
  return prepared.tilesets.map((tileset) => {
    const image = tileset.decodedImage;
    tileset.decodedImage = undefined;
    return image;
  });
}

interface DecodeScope {
  decodeTilesets: (
    tilesets: TilesetFrameTable[],
    mapId: string,
  ) => Promise<PreparedTileset[]>;
  signal: AbortSignal;
}

async function withDecodeScope<T>(
  dependencies: Pick<
    PrepareCampusMapDependencies,
    "loadImage" | "onProgress" | "signal"
  >,
  run: (scope: DecodeScope) => Promise<T>,
): Promise<T> {
  const { loadImage, onProgress, signal } = dependencies;
  const work = new AbortController();
  const decodedImages = new Set<ImageBitmap>();
  const forwardAbort = () => work.abort(signal.reason);

  async function decodeTileset(
    tileset: TilesetFrameTable,
    mapId: string,
  ): Promise<ImageBitmap> {
    let decodedImage: ImageBitmap;

    try {
      decodedImage = await loadImage(tileset.image, work.signal);
    } catch (error) {
      work.signal.throwIfAborted();
      throw new CampusMapError(
        "network",
        "A campus tileset could not be loaded or decoded.",
        { cause: error, mapId },
      );
    }

    if (work.signal.aborted) {
      decodedImage.close();
      work.signal.throwIfAborted();
    }

    decodedImages.add(decodedImage);
    return decodedImage;
  }

  function decodeTilesets(
    tilesets: TilesetFrameTable[],
    mapId: string,
  ): Promise<PreparedTileset[]> {
    const total = tilesets.length;
    let completed = 0;
    onProgress?.({ completed, stage: "tilesets", total });

    return Promise.all(
      tilesets.map(async (tileset): Promise<PreparedTileset> => {
        const decodedImage = await decodeTileset(tileset, mapId);
        completed += 1;
        onProgress?.({ completed, stage: "tilesets", total });
        return { ...tileset, decodedImage };
      }),
    );
  }

  signal.throwIfAborted();
  signal.addEventListener("abort", forwardAbort, { once: true });

  try {
    return await run({ decodeTilesets, signal: work.signal });
  } catch (error) {
    work.abort(error);
    decodedImages.forEach((image) => image.close());
    signal.throwIfAborted();
    throw error;
  } finally {
    signal.removeEventListener("abort", forwardAbort);
  }
}

export async function prepareCampusMap(
  source: MapSource,
  dependencies: PrepareCampusMapDependencies,
): Promise<PreparedCampusMap> {
  const timer = startTimer(dependencies.now);

  return withDecodeScope(dependencies, async ({ decodeTilesets, signal }) => {
    const kaplayLoad = dependencies.loadKaplay();
    // Started before the map loads; a rejection is classified once awaited.
    kaplayLoad.catch(() => undefined);

    const loaded = await loadCampusMap(source, {
      dataset: dependencies.dataset,
      fetch: dependencies.fetch,
      onStageChange: (stage) => dependencies.onProgress?.({ stage }),
      projectId: dependencies.projectId,
      signal,
    });
    const mapId = loaded.manifest.mapId;
    const tilesetsPromise = decodeTilesets(loaded.tilesets, mapId).then(
      (tilesets) => {
        dependencies.onProgress?.({ stage: "runtime", total: tilesets.length });
        return tilesets;
      },
    );
    const kaplayModulePromise = kaplayLoad.catch((error) => {
      signal.throwIfAborted();
      throw new CampusMapError(
        "render",
        "The campus rendering runtime could not be loaded.",
        { cause: error, mapId },
      );
    });
    const [tilesets, kaplayModule] = await Promise.all([
      tilesetsPromise,
      kaplayModulePromise,
    ]);

    return {
      ...loaded,
      kaplayModule,
      preparationMs: timer.elapsedMs(),
      tilesets,
    };
  });
}
