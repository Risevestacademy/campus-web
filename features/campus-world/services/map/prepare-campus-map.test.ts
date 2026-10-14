import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fakeImage,
  releasePreparedTilesetImage,
  sanityConfiguration,
  stubSanityFetch,
  tilesetCount,
} from "../../testing/sanity-map-fixture";
import {
  type CampusMapModule,
  isPreparedCampusMapRenderReady,
  loadDecodedCampusMapImage,
  prepareCampusMap,
  type PrepareCampusMapDependencies,
} from "./prepare-campus-map";

function prepare(overrides: Partial<PrepareCampusMapDependencies> = {}) {
  return prepareCampusMap(
    { kind: "entry" },
    {
      ...sanityConfiguration,
      fetch: stubSanityFetch(),
      loadImage: vi.fn(async () => fakeImage()),
      loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
      signal: new AbortController().signal,
      ...overrides,
    },
  );
}

function pendingUntilAborted<T>(signal: AbortSignal) {
  return new Promise<T>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadDecodedCampusMapImage", () => {
  it("invokes a browser fetch implementation with the global receiver", async () => {
    const decodedImage = fakeImage();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => decodedImage),
    );
    const fetchImplementation = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis);
      return Promise.resolve(new Response(new Uint8Array()));
    }) as unknown as typeof globalThis.fetch;

    await expect(
      loadDecodedCampusMapImage("https://cdn.example/campus.png", {
        fetch: fetchImplementation,
        signal: new AbortController().signal,
      }),
    ).resolves.toBe(decodedImage);
  });
});

describe("prepareCampusMap", () => {
  it("starts loading KAPLAY before the manifest answers", async () => {
    const controller = new AbortController();
    const loadKaplay = vi.fn(async () => ({}) as CampusMapModule);
    const preparation = prepare({
      fetch: ((_input: RequestInfo | URL, init?: RequestInit) =>
        pendingUntilAborted<Response>(init!.signal!)) as typeof fetch,
      loadKaplay,
      signal: controller.signal,
    });

    expect(loadKaplay).toHaveBeenCalledOnce();

    controller.abort();
    await expect(preparation).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not report ready before the KAPLAY module resolves", async () => {
    let resolveKaplay: ((module: CampusMapModule) => void) | undefined;
    const loadImage = vi.fn(async () => fakeImage());
    let settled = false;

    const preparation = prepare({
      loadImage,
      loadKaplay: () =>
        new Promise<CampusMapModule>((resolve) => {
          resolveKaplay = resolve;
        }),
    }).then(() => {
      settled = true;
    });

    await vi.waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(tilesetCount);
    });
    expect(settled).toBe(false);

    resolveKaplay?.({} as CampusMapModule);
    await preparation;
    expect(settled).toBe(true);
  });

  it("releases decoded images when preparation is cancelled", async () => {
    const controller = new AbortController();
    const decodedImage = fakeImage();
    const loadImage = vi
      .fn<(url: string, signal: AbortSignal) => Promise<ImageBitmap>>()
      .mockResolvedValueOnce(decodedImage)
      .mockImplementation((_url, signal) => pendingUntilAborted(signal));

    const preparation = prepare({ loadImage, signal: controller.signal });

    await vi.waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(tilesetCount);
    });
    controller.abort();

    await expect(preparation).rejects.toMatchObject({ name: "AbortError" });
    expect(decodedImage.close).toHaveBeenCalledOnce();
  });

  it("reports only completed preparation stages and decoded tilesets", async () => {
    const onProgress = vi.fn();

    await prepare({ onProgress });

    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { stage: "manifest" },
      { stage: "map" },
      { completed: 0, stage: "tilesets", total: 3 },
      { completed: 1, stage: "tilesets", total: 3 },
      { completed: 2, stage: "tilesets", total: 3 },
      { completed: 3, stage: "tilesets", total: 3 },
      { stage: "runtime", total: 3 },
    ]);
  });

  it("classifies tileset decoding failures with the loaded map identity", async () => {
    await expect(
      prepare({
        loadImage: vi.fn(async () => {
          throw new Error("Image decoding failed.");
        }),
      }),
    ).rejects.toMatchObject({ kind: "network", mapId: "campus" });
  });

  it("classifies KAPLAY chunk failures with the loaded map identity", async () => {
    await expect(
      prepare({
        loadKaplay: vi.fn(async () => {
          throw new Error("Chunk failed to load.");
        }),
      }),
    ).rejects.toMatchObject({ kind: "render", mapId: "campus" });
  });
});

describe("isPreparedCampusMapRenderReady", () => {
  const holdsNothing = () => false;

  it("is ready while every tileset image is decoded", async () => {
    expect(isPreparedCampusMapRenderReady(await prepare(), holdsNothing)).toBe(
      true,
    );
  });

  it("is ready without decoded images once the runtime holds that version", async () => {
    const prepared = await prepare();
    prepared.tilesets.forEach(releasePreparedTilesetImage);
    const holdsMap = vi.fn(
      ({ mapId, version }: { mapId: string; version: string }) =>
        mapId === "campus" && version === "version-1",
    );

    expect(isPreparedCampusMapRenderReady(prepared, holdsMap)).toBe(true);
  });

  it("is not ready when one image was consumed and the runtime lacks the map", async () => {
    const prepared = await prepare();
    releasePreparedTilesetImage(prepared.tilesets[0]!);

    expect(isPreparedCampusMapRenderReady(prepared, holdsNothing)).toBe(false);
  });
});
