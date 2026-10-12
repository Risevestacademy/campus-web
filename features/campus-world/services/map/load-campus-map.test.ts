import { describe, expect, it, vi } from "vitest";

import {
  entryManifest,
  jsonResponse,
  mapUrl,
  sanityConfiguration,
  stubSanityFetch,
} from "../../testing/sanity-map-fixture";
import { loadCampusMap, sanityMapOrigins } from "./load-campus-map";

describe("loadCampusMap", () => {
  it("selects and prepares the current entry map", async () => {
    const entry = entryManifest();
    const fetch = stubSanityFetch([entryManifest("annex", false), entry]);

    const loaded = await loadCampusMap(
      { kind: "entry" },
      { ...sanityConfiguration, fetch },
    );

    expect(loaded.manifest).toEqual(entry);
    expect(loaded.map.tilesets[0]?.image).toBe(
      "https://cdn.sanity.io/images/sj3zsz66/staging/grounds.png",
    );
    expect(loaded.layout.spawn).toEqual({ x: 1, y: 1 });
    expect(loaded.bands.below.map(({ name }) => name)).toEqual([
      "ground",
      "chairs",
    ]);
    expect(loaded.bands.above.map(({ name }) => name)).toEqual([
      "walls",
      "trees",
    ]);
    expect(loaded.tilesets).toHaveLength(3);
    expect(loaded.tilesets[2]?.frames).toHaveLength(270);
  });

  it("loads an immutable pinned version through Sanity's CDN", async () => {
    const pinned = entryManifest("campus", true, "version-pinned");
    const fetch = stubSanityFetch(pinned);

    const loaded = await loadCampusMap(
      { kind: "pinned", mapId: "campus", version: "version-pinned" },
      { ...sanityConfiguration, fetch },
    );

    const manifestUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(manifestUrl).toContain("sj3zsz66.apicdn.sanity.io");
    expect(new URL(manifestUrl).searchParams.get("$id")).toBe(
      '"worldMap-campus-version-pinned"',
    );
    expect(loaded.manifest).toEqual(pinned);
  });

  it("reports a manifest failure when no current map is the entry", async () => {
    const fetch = stubSanityFetch([entryManifest("annex", false)]);

    await expect(
      loadCampusMap({ kind: "entry" }, { ...sanityConfiguration, fetch }),
    ).rejects.toMatchObject({ kind: "manifest" });
  });

  it("reports an HTTP failure as a network failure", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({}, 503),
    ) as unknown as typeof globalThis.fetch;

    await expect(
      loadCampusMap({ kind: "entry" }, { ...sanityConfiguration, fetch }),
    ).rejects.toMatchObject({ kind: "network", mapId: null });
  });

  it("retains the map ID when a failure happens after manifest lookup", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input) === mapUrl
        ? jsonResponse({}, 503)
        : jsonResponse({ result: [entryManifest()] }),
    ) as unknown as typeof globalThis.fetch;

    await expect(
      loadCampusMap({ kind: "entry" }, { ...sanityConfiguration, fetch }),
    ).rejects.toMatchObject({ kind: "network", mapId: "campus" });
  });
});

describe("sanityMapOrigins", () => {
  it("names every origin the entry map and its artwork load from", async () => {
    const fetch = stubSanityFetch();
    const loaded = await loadCampusMap(
      { kind: "entry" },
      { ...sanityConfiguration, fetch },
    );
    const requestedOrigins = [
      ...vi.mocked(fetch).mock.calls.map(([input]) => String(input)),
      ...loaded.tilesets.map(({ image }) => image),
    ].map((url) => new URL(url).origin);

    expect(sanityMapOrigins(sanityConfiguration.projectId)).toEqual(
      expect.arrayContaining([...new Set(requestedOrigins)]),
    );
  });

  it("names no origins without a public project", () => {
    expect(sanityMapOrigins(undefined)).toEqual([]);
  });
});
