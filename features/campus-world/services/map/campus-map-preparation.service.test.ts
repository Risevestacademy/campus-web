import { describe, expect, it, vi } from "vitest";

import {
  fakeImage,
  jsonResponse,
  sanityConfiguration,
  stubSanityFetch,
} from "../../testing/sanity-map-fixture";
import {
  type CampusMapPreparationDependencies,
  prepareCampusWorldMap,
} from "./campus-map-preparation.service";
import type { CampusMapModule } from "./prepare-campus-map";

function dependencies(
  overrides: Partial<CampusMapPreparationDependencies> = {},
): CampusMapPreparationDependencies {
  return {
    captureEvent: vi.fn(),
    configuration: sanityConfiguration,
    fetch: stubSanityFetch(),
    loadImage: vi.fn(async () => fakeImage()),
    loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
    ...overrides,
  };
}

function prepare(
  preparationDependencies: CampusMapPreparationDependencies,
  signal = new AbortController().signal,
) {
  return prepareCampusWorldMap({ kind: "entry" }, preparationDependencies, {
    signal,
  });
}

describe("prepareCampusWorldMap", () => {
  it("reports the prepared map with its preparation time", async () => {
    const preparation = dependencies({
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(142),
    });

    const prepared = await prepare(preparation);

    expect(prepared.manifest.mapId).toBe("campus");
    expect(preparation.captureEvent).toHaveBeenCalledExactlyOnceWith(
      "campus_world.map_loaded",
      { load_ms: 42, map_id: "campus", tilesets: 3, version: "version-1" },
    );
  });

  it("fails as a configuration error without fetching when Sanity is unset", async () => {
    const preparation = dependencies({ configuration: {} });

    await expect(prepare(preparation)).rejects.toMatchObject({
      kind: "config",
    });
    expect(preparation.fetch).not.toHaveBeenCalled();
    expect(preparation.captureEvent).toHaveBeenCalledExactlyOnceWith(
      "campus_world.map_failed",
      { error_kind: "config", map_id: null },
    );
  });

  it("reports a classified failure with the loaded map identity", async () => {
    const preparation = dependencies({
      loadImage: vi.fn(async () => {
        throw new Error("Image decoding failed.");
      }),
    });

    await expect(prepare(preparation)).rejects.toMatchObject({
      kind: "network",
    });
    expect(preparation.captureEvent).toHaveBeenCalledExactlyOnceWith(
      "campus_world.map_failed",
      { error_kind: "network", map_id: "campus" },
    );
  });

  it("reports nothing when the preparation is cancelled", async () => {
    const controller = new AbortController();
    const preparation = dependencies({
      fetch: vi.fn(async () => {
        controller.abort();
        return jsonResponse({ error: "cancelled" }, 503);
      }) as unknown as typeof globalThis.fetch,
    });

    await expect(prepare(preparation, controller.signal)).rejects.toMatchObject(
      { name: "AbortError" },
    );
    expect(preparation.captureEvent).not.toHaveBeenCalled();
  });
});
