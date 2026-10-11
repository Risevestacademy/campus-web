import { describe, expect, it, vi } from "vitest";

import mapFixture from "./fixtures/campus-trimmed.json";
import { loadCampusMap } from "./load-campus-map";

const projectId = "sj3zsz66";
const dataset = "staging";
const mapUrl = "https://cdn.sanity.io/files/sj3zsz66/staging/map.json";

function manifest(mapId: string, isEntry: boolean, version = "version-1") {
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

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function stubFetch(queryResult: unknown) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    return url === mapUrl
      ? response(mapFixture)
      : response({ result: queryResult });
  }) as unknown as typeof fetch;
}

describe("loadCampusMap", () => {
  it("selects and prepares the current entry map", async () => {
    const entry = manifest("campus", true);
    const fetch = stubFetch([manifest("annex", false), entry]);

    const loaded = await loadCampusMap(
      { kind: "entry" },
      { dataset, fetch, projectId },
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
    const pinned = manifest("campus", true, "version-pinned");
    const fetch = stubFetch(pinned);

    const loaded = await loadCampusMap(
      { kind: "pinned", mapId: "campus", version: "version-pinned" },
      { dataset, fetch, projectId },
    );

    const manifestUrl = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(manifestUrl).toContain("sj3zsz66.apicdn.sanity.io");
    expect(new URL(manifestUrl).searchParams.get("$id")).toBe(
      '"worldMap-campus-version-pinned"',
    );
    expect(loaded.manifest).toEqual(pinned);
  });

  it("reports a manifest failure when no current map is the entry", async () => {
    const fetch = stubFetch([manifest("annex", false)]);

    await expect(
      loadCampusMap({ kind: "entry" }, { dataset, fetch, projectId }),
    ).rejects.toMatchObject({ kind: "manifest" });
  });

  it("reports an HTTP failure as a network failure", async () => {
    const fetch = vi.fn(async () =>
      response({}, 503),
    ) as unknown as typeof globalThis.fetch;

    await expect(
      loadCampusMap({ kind: "entry" }, { dataset, fetch, projectId }),
    ).rejects.toMatchObject({
      kind: "network",
      mapId: null,
    });
  });

  it("retains the map ID when a failure happens after manifest lookup", async () => {
    const entry = manifest("campus", true);
    const fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input) === mapUrl
        ? response({}, 503)
        : response({ result: [entry] }),
    ) as unknown as typeof globalThis.fetch;

    await expect(
      loadCampusMap({ kind: "entry" }, { dataset, fetch, projectId }),
    ).rejects.toMatchObject({
      kind: "network",
      mapId: "campus",
    });
  });
});
