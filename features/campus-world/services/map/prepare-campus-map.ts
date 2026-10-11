import type { CampusWorldMapErrorKind } from "@/core/analytics/events";

import {
  loadCampusMap,
  type LoadedCampusMap,
  type MapSource,
} from "./load-campus-map";
import type { TilesetFrameTable } from "./tile-frames";

export type CampusMapModule = typeof import("kaplay");

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

export type RehydrateCampusMapDependencies = Pick<
  PrepareCampusMapDependencies,
  "loadImage" | "now" | "onProgress" | "signal"
>;

export class CampusMapPreparationError extends Error {
  readonly kind: CampusWorldMapErrorKind;
  readonly mapId: string | null;

  constructor(
    kind: CampusWorldMapErrorKind,
    message: string,
    options: { cause?: unknown; mapId?: string | null } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "CampusMapPreparationError";
    this.kind = kind;
    this.mapId = options.mapId ?? null;
  }
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

export function releasePreparedTilesetImage(tileset: PreparedTileset): void {
  tileset.decodedImage?.close();
  tileset.decodedImage = undefined;
}

export function isPreparedCampusMapRenderReady(
  prepared: PreparedCampusMap,
): boolean {
  return prepared.tilesets.every(
    ({ decodedImage }) => decodedImage !== undefined,
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

export async function rehydratePreparedCampusMap(
  prepared: PreparedCampusMap,
  dependencies: RehydrateCampusMapDependencies,
): Promise<PreparedCampusMap> {
  const now = dependencies.now ?? performance.now.bind(performance);
  const startedAt = now();
  const work = new AbortController();
  const decodedImages = new Set<ImageBitmap>();
  const forwardAbort = () => work.abort(dependencies.signal.reason);
  const total = prepared.tilesets.length;
  let completed = 0;

  dependencies.signal.throwIfAborted();
  dependencies.signal.addEventListener("abort", forwardAbort, { once: true });
  prepared.tilesets.forEach(releasePreparedTilesetImage);
  dependencies.onProgress?.({ completed, stage: "tilesets", total });

  try {
    const tilesets = await Promise.all(
      prepared.tilesets.map(async (tileset): Promise<PreparedTileset> => {
        let decodedImage: ImageBitmap;

        try {
          decodedImage = await dependencies.loadImage(
            tileset.image,
            work.signal,
          );
        } catch (error) {
          work.signal.throwIfAborted();
          throw new CampusMapPreparationError(
            "network",
            "A campus tileset could not be loaded or decoded.",
            { cause: error, mapId: prepared.manifest.mapId },
          );
        }

        if (work.signal.aborted) {
          decodedImage.close();
          work.signal.throwIfAborted();
        }

        decodedImages.add(decodedImage);
        completed += 1;
        dependencies.onProgress?.({ completed, stage: "tilesets", total });
        return { ...tileset, decodedImage };
      }),
    );

    return {
      ...prepared,
      preparationMs: Math.round(now() - startedAt),
      tilesets,
    };
  } catch (error) {
    work.abort(error);
    decodedImages.forEach((image) => image.close());
    dependencies.signal.throwIfAborted();
    throw error;
  } finally {
    dependencies.signal.removeEventListener("abort", forwardAbort);
  }
}

export async function prepareCampusMap(
  source: MapSource,
  dependencies: PrepareCampusMapDependencies,
): Promise<PreparedCampusMap> {
  const now = dependencies.now ?? performance.now.bind(performance);
  const startedAt = now();
  const work = new AbortController();
  const decodedImages = new Set<ImageBitmap>();
  const forwardAbort = () => work.abort(dependencies.signal.reason);

  dependencies.signal.throwIfAborted();
  dependencies.signal.addEventListener("abort", forwardAbort, { once: true });

  try {
    const loaded = await loadCampusMap(source, {
      dataset: dependencies.dataset,
      fetch: dependencies.fetch,
      onStageChange: (stage) => dependencies.onProgress?.({ stage }),
      projectId: dependencies.projectId,
      signal: work.signal,
    });
    const total = loaded.tilesets.length;
    let completed = 0;

    dependencies.onProgress?.({ completed, stage: "tilesets", total });

    const tilesetsPromise = Promise.all(
      loaded.tilesets.map(async (tileset): Promise<PreparedTileset> => {
        let decodedImage: ImageBitmap;

        try {
          decodedImage = await dependencies.loadImage(
            tileset.image,
            work.signal,
          );
        } catch (error) {
          work.signal.throwIfAborted();
          throw new CampusMapPreparationError(
            "network",
            "A campus tileset could not be loaded or decoded.",
            { cause: error, mapId: loaded.manifest.mapId },
          );
        }

        if (work.signal.aborted) {
          decodedImage.close();
          work.signal.throwIfAborted();
        }

        decodedImages.add(decodedImage);
        completed += 1;
        dependencies.onProgress?.({
          completed,
          stage: "tilesets",
          total,
        });
        return { ...tileset, decodedImage };
      }),
    ).then((tilesets) => {
      dependencies.onProgress?.({ stage: "runtime", total });
      return tilesets;
    });
    const kaplayModulePromise = dependencies.loadKaplay().catch((error) => {
      work.signal.throwIfAborted();
      throw new CampusMapPreparationError(
        "render",
        "The campus rendering runtime could not be loaded.",
        { cause: error, mapId: loaded.manifest.mapId },
      );
    });
    const [tilesets, kaplayModule] = await Promise.all([
      tilesetsPromise,
      kaplayModulePromise,
    ]);

    return {
      ...loaded,
      kaplayModule,
      preparationMs: Math.round(now() - startedAt),
      tilesets,
    };
  } catch (error) {
    work.abort(error);
    decodedImages.forEach((image) => image.close());
    dependencies.signal.throwIfAborted();
    throw error;
  } finally {
    dependencies.signal.removeEventListener("abort", forwardAbort);
  }
}
