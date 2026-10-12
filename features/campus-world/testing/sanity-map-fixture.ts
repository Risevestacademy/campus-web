import { vi } from "vitest";

import mapFixture from "../services/map/fixtures/campus-trimmed.json";

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
  return vi.fn(async (input: RequestInfo | URL) =>
    String(input) === mapUrl
      ? jsonResponse(mapFixture)
      : jsonResponse({ result: queryResult }),
  ) as unknown as typeof globalThis.fetch;
}

export function fakeImage(): ImageBitmap {
  return { close: vi.fn() } as unknown as ImageBitmap;
}

export const tilesetCount = mapFixture.tilesets.length;
