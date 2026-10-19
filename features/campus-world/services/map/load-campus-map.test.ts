import { describe, expect, it, vi } from "vitest";

import {
  entryManifest,
  jsonResponse,
  mapUrl,
  sanityConfiguration,
  stubSanityFetch,
} from "../../testing/sanity-map-fixture";
import mapFixture from "./fixtures/campus-trimmed.json";
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
      {
        kind: "pinned",
        mapId: "campus",
        version: "version-pinned",
        width: mapFixture.width,
        height: mapFixture.height,
      },
      { ...sanityConfiguration, fetch },
    );

    const manifestUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(manifestUrl).toContain("sj3zsz66.apicdn.sanity.io");
    expect(new URL(manifestUrl).searchParams.get("$id")).toBe(
      '"worldMap-campus-version-pinned"',
    );
    expect(loaded.manifest).toEqual(pinned);
  });

  it("refuses pinned artwork whose manifest dimensions differ from world", async () => {
    const pinned = {
      ...entryManifest("campus", true, "version-pinned"),
      widthTiles: mapFixture.width + 1,
    };
    const fetch = stubSanityFetch(pinned);

    await expect(
      loadCampusMap(
        {
          kind: "pinned",
          mapId: "campus",
          version: "version-pinned",
          width: mapFixture.width,
          height: mapFixture.height,
        },
        { ...sanityConfiguration, fetch },
      ),
    ).rejects.toMatchObject({ kind: "layout", mapId: "campus" });
    expect(
      vi.mocked(fetch).mock.calls.map(([input]) => String(input)),
    ).not.toContain(mapUrl);
  });

  it("refuses pinned map JSON whose dimensions differ from world", async () => {
    const pinned = entryManifest("campus", true, "version-pinned");
    const fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input) === mapUrl
        ? jsonResponse({ ...mapFixture, height: mapFixture.height + 1 })
        : jsonResponse({ result: pinned }),
    ) as unknown as typeof globalThis.fetch;

    await expect(
      loadCampusMap(
        {
          kind: "pinned",
          mapId: "campus",
          version: "version-pinned",
          width: mapFixture.width,
          height: mapFixture.height,
        },
        { ...sanityConfiguration, fetch },
      ),
    ).rejects.toMatchObject({ kind: "layout", mapId: "campus" });
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

  it("refuses a map JSON hosted outside the Sanity dataset before fetching it", async () => {
    const foreignMap = "https://evil.example/map.json";
    const fetch = stubSanityFetch([{ ...entryManifest(), mapUrl: foreignMap }]);

    await expect(
      loadCampusMap({ kind: "entry" }, { ...sanityConfiguration, fetch }),
    ).rejects.toMatchObject({ kind: "manifest", mapId: "campus" });
    expect(
      vi.mocked(fetch).mock.calls.map(([input]) => String(input)),
    ).not.toContain(foreignMap);
  });

  it("refuses tileset artwork from another Sanity project", async () => {
    const manifest = entryManifest();
    const [first, ...rest] = manifest.tilesets;
    const fetch = stubSanityFetch([
      {
        ...manifest,
        tilesets: [
          {
            ...first!,
            url: "https://cdn.sanity.io/images/other/staging/a.png",
          },
          ...rest,
        ],
      },
    ]);

    await expect(
      loadCampusMap({ kind: "entry" }, { ...sanityConfiguration, fetch }),
    ).rejects.toMatchObject({ kind: "manifest", mapId: "campus" });
  });

  it("reports tile data the renderer cannot draw as a layout failure", async () => {
    const [ground, ...rest] = mapFixture.layers;
    const brokenMap = {
      ...mapFixture,
      layers: [{ ...ground, data: "AAAA" }, ...rest],
    };
    const fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input) === mapUrl
        ? jsonResponse(brokenMap)
        : jsonResponse({ result: [entryManifest()] }),
    ) as unknown as typeof globalThis.fetch;

    await expect(
      loadCampusMap({ kind: "entry" }, { ...sanityConfiguration, fetch }),
    ).rejects.toMatchObject({ kind: "layout", mapId: "campus" });
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
