import { vi } from "vitest";

import mapFixture from "../services/map/fixtures/campus-trimmed.json";
import type { PreparedTileset } from "../services/map/prepare-campus-map";

export const sanityConfiguration = {
  dataset: "staging",
  projectId: "sj3zsz66",
};
export const mapUrl = "https://cdn.sanity.io/files/sj3zsz66/staging/map.json";

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

export function entryManifest(
  mapId = "campus",
  isEntry = true,
  version = "version-1",
) {
  return {
    heightTiles: mapFixture.height,
    isEntry,
    mapId,
    mapUrl,
    tilesets: mapFixture.tilesets.map(({ image }) => ({
      tiledImagePath: image,
      url: `https://cdn.sanity.io/images/sj3zsz66/staging/${image.split("/").at(-1)}`,
    })),
    version,
    widthTiles: mapFixture.width,
  };
}

export function stubSanityFetch(queryResult: unknown = [entryManifest()]) {
  const maps = Array.isArray(queryResult) ? queryResult : [queryResult];
  const entry =
    maps.find((manifest) => (manifest as { isEntry?: unknown }).isEntry) ??
    maps[0];
  const single = Array.isArray(queryResult) ? entry : queryResult;
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === mapUrl) return jsonResponse(mapFixture);
    // The current-versions list reads its result as an array; the one map a
    // member's snapshot pins reads a single manifest. The query text tells
    // them apart before either is answered.
    const listQuery = url.includes("%22worldMap%22");
    return jsonResponse({ result: listQuery ? maps : single });
  }) as unknown as typeof globalThis.fetch;
}

export function fakeImage(): ImageBitmap {
  return { close: vi.fn() } as unknown as ImageBitmap;
}

export const tilesetCount = mapFixture.tilesets.length;

export function releasePreparedTilesetImage(tileset: PreparedTileset): void {
  tileset.decodedImage?.close();
  tileset.decodedImage = undefined;
}
