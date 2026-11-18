import { describe, expect, it, vi } from "vitest";

import mapFixture from "@/features/campus-world/services/map/fixtures/campus-trimmed.json";
import { loadCampusMap } from "@/features/campus-world/services/map/load-campus-map";
import {
  entryManifest,
  jsonResponse,
  mapUrl,
  sanityConfiguration,
} from "@/features/campus-world/testing/sanity-map-fixture";

// Anyone who can edit the Sanity dataset shapes these manifests and maps, so
// the browser treats both as untrusted until they parse.

const QUERY_ORIGIN = `https://${sanityConfiguration.projectId}.api.sanity.io`;

const HOSTILE_MAP_URLS = [
  "https://evil.example/map.json",
  "http://cdn.sanity.io/files/sj3zsz66/staging/map.json",
  "https://cdn.sanity.io/files/other/staging/map.json",
  "https://cdn.sanity.io/files/sj3zsz66/production/map.json",
  "https://cdn.sanity.io/files/sj3zsz66/staging/../../other/staging/map.json",
  "https://cdn.sanity.io.evil.example/files/sj3zsz66/staging/map.json",
  "javascript:alert(1)",
  "/files/sj3zsz66/staging/map.json",
];

const [ground, ...otherLayers] = mapFixture.layers;
const [firstTileset, ...otherTilesets] = mapFixture.tilesets;

const HOSTILE_MAPS: [string, unknown][] = [
  [
    "base64 tile data",
    { ...mapFixture, layers: [{ ...ground, data: "AAAA" }, ...otherLayers] },
  ],
  [
    "an infinite map",
    {
      ...mapFixture,
      infinite: true,
      layers: [{ ...ground, data: undefined, chunks: [] }, ...otherLayers],
    },
  ],
  [
    "a tileset with no columns",
    {
      ...mapFixture,
      tilesets: [{ ...firstTileset, columns: 0 }, ...otherTilesets],
    },
  ],
  [
    "a zero-width tileset image",
    {
      ...mapFixture,
      tilesets: [{ ...firstTileset, imagewidth: 0 }, ...otherTilesets],
    },
  ],
  ["text tile sizes", { ...mapFixture, tilewidth: "32" }],
  ["no layers", { ...mapFixture, layers: undefined }],
];

function recordingFetch(manifest: unknown, map: unknown = mapFixture) {
  return vi.fn(async (input: RequestInfo | URL) =>
    String(input) === mapUrl
      ? jsonResponse(map)
      : jsonResponse({ result: [manifest] }),
  ) as unknown as typeof globalThis.fetch;
}

describe("Campus map trust eval (threshold: every case holds)", () => {
  describe("a published manifest cannot send the browser to another host", () => {
    it.each(HOSTILE_MAP_URLS)("refuses the map JSON at %s", async (url) => {
      const fetch = recordingFetch({ ...entryManifest(), mapUrl: url });

      await expect(
        loadCampusMap({ kind: "entry" }, { ...sanityConfiguration, fetch }),
      ).rejects.toMatchObject({ name: "CampusMapError", kind: "manifest" });
      for (const [input] of vi.mocked(fetch).mock.calls) {
        expect(new URL(String(input)).origin).toBe(QUERY_ORIGIN);
      }
    });

    it.each(HOSTILE_MAP_URLS)("refuses tileset artwork at %s", async (url) => {
      const manifest = entryManifest();
      const [first, ...rest] = manifest.tilesets;
      const fetch = recordingFetch({
        ...manifest,
        tilesets: [{ ...first!, url }, ...rest],
      });

      await expect(
        loadCampusMap({ kind: "entry" }, { ...sanityConfiguration, fetch }),
      ).rejects.toMatchObject({ name: "CampusMapError", kind: "manifest" });
    });
  });

  describe("a published map cannot hand the renderer numbers it cannot draw", () => {
    it.each(HOSTILE_MAPS)("reports %s as a layout failure", async (_, map) => {
      const fetch = recordingFetch(entryManifest(), map);

      await expect(
        loadCampusMap({ kind: "entry" }, { ...sanityConfiguration, fetch }),
      ).rejects.toMatchObject({
        name: "CampusMapError",
        kind: "layout",
        mapId: "campus",
      });
    });
  });
});
