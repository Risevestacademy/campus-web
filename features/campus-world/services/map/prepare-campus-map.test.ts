import { afterEach, describe, expect, it, vi } from "vitest";

import mapFixture from "./fixtures/campus-trimmed.json";
import {
  type CampusMapModule,
  isPreparedCampusMapRenderReady,
  loadDecodedCampusMapImage,
  prepareCampusMap,
  rehydratePreparedCampusMap,
  releasePreparedTilesetImage,
} from "./prepare-campus-map";

const dataset = "staging";
const projectId = "sj3zsz66";
const mapUrl = "https://cdn.sanity.io/files/sj3zsz66/staging/campus-map.json";

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function manifest() {
  return {
    heightTiles: mapFixture.height,
    isEntry: true,
    mapId: "campus",
    mapUrl,
    tilesets: mapFixture.tilesets.map(({ image }) => ({
      tiledImagePath: image,
      url: `https://cdn.sanity.io/images/${projectId}/${dataset}/${image.split("/").at(-1)}`,
    })),
    version: "version-1",
    widthTiles: mapFixture.width,
  };
}

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) =>
    String(input) === mapUrl
      ? response(mapFixture)
      : response({ result: [manifest()] }),
  ) as unknown as typeof globalThis.fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadDecodedCampusMapImage", () => {
  it("invokes a browser fetch implementation with the global receiver", async () => {
    const decodedImage = { close: vi.fn() } as unknown as ImageBitmap;
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
  it("does not report ready while a tileset remains undecoded", async () => {
    const decodedImages: Array<(image: ImageBitmap) => void> = [];
    const loadImage = vi.fn(
      () =>
        new Promise<ImageBitmap>((resolve) => {
          decodedImages.push(resolve);
        }),
    );
    let settled = false;

    const preparation = prepareCampusMap(
      { kind: "entry" },
      {
        dataset,
        fetch: stubFetch(),
        loadImage,
        loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
        projectId,
        signal: new AbortController().signal,
      },
    ).then(() => {
      settled = true;
    });

    await vi.waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(mapFixture.tilesets.length);
    });

    for (const resolveImage of decodedImages.slice(0, -1)) {
      resolveImage({ close: vi.fn() } as unknown as ImageBitmap);
    }
    await Promise.resolve();

    expect(settled).toBe(false);

    decodedImages.at(-1)?.({ close: vi.fn() } as unknown as ImageBitmap);
    await preparation;
    expect(settled).toBe(true);
  });

  it("releases decoded images when preparation is cancelled", async () => {
    const controller = new AbortController();
    const close = vi.fn();
    const decodedImage = { close } as unknown as ImageBitmap;
    const loadImage = vi
      .fn<(url: string, signal: AbortSignal) => Promise<ImageBitmap>>()
      .mockResolvedValueOnce(decodedImage)
      .mockImplementation(
        (_url, signal) =>
          new Promise<ImageBitmap>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          }),
      );

    const preparation = prepareCampusMap(
      { kind: "entry" },
      {
        dataset,
        fetch: stubFetch(),
        loadImage,
        loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
        projectId,
        signal: controller.signal,
      },
    );

    await vi.waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(mapFixture.tilesets.length);
    });

    controller.abort();

    await expect(preparation).rejects.toMatchObject({ name: "AbortError" });
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not report ready before the KAPLAY module resolves", async () => {
    let resolveKaplay: ((module: CampusMapModule) => void) | undefined;
    const loadKaplay = vi.fn(
      () =>
        new Promise<CampusMapModule>((resolve) => {
          resolveKaplay = resolve;
        }),
    );
    const loadImage = vi.fn(
      async () => ({ close: vi.fn() }) as unknown as ImageBitmap,
    );
    let settled = false;

    const preparation = prepareCampusMap(
      { kind: "entry" },
      {
        dataset,
        fetch: stubFetch(),
        loadImage,
        loadKaplay,
        projectId,
        signal: new AbortController().signal,
      },
    ).then(() => {
      settled = true;
    });

    await vi.waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(mapFixture.tilesets.length);
    });
    expect(settled).toBe(false);

    resolveKaplay?.({} as CampusMapModule);
    await preparation;
    expect(settled).toBe(true);
  });

  it("reports only completed preparation stages and decoded tilesets", async () => {
    const onProgress = vi.fn();

    await prepareCampusMap(
      { kind: "entry" },
      {
        dataset,
        fetch: stubFetch(),
        loadImage: vi.fn(
          async () => ({ close: vi.fn() }) as unknown as ImageBitmap,
        ),
        loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
        onProgress,
        projectId,
        signal: new AbortController().signal,
      },
    );

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
      prepareCampusMap(
        { kind: "entry" },
        {
          dataset,
          fetch: stubFetch(),
          loadImage: vi.fn(async () => {
            throw new Error("Image decoding failed.");
          }),
          loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
          projectId,
          signal: new AbortController().signal,
        },
      ),
    ).rejects.toMatchObject({ kind: "network", mapId: "campus" });
  });

  it("classifies KAPLAY chunk failures with the loaded map identity", async () => {
    await expect(
      prepareCampusMap(
        { kind: "entry" },
        {
          dataset,
          fetch: stubFetch(),
          loadImage: vi.fn(
            async () => ({ close: vi.fn() }) as unknown as ImageBitmap,
          ),
          loadKaplay: vi.fn(async () => {
            throw new Error("Chunk failed to load.");
          }),
          projectId,
          signal: new AbortController().signal,
        },
      ),
    ).rejects.toMatchObject({ kind: "render", mapId: "campus" });
  });
});

describe("rehydratePreparedCampusMap", () => {
  async function consumedPreparedMap() {
    const prepared = await prepareCampusMap(
      { kind: "entry" },
      {
        dataset,
        fetch: stubFetch(),
        loadImage: vi.fn(
          async () => ({ close: vi.fn() }) as unknown as ImageBitmap,
        ),
        loadKaplay: vi.fn(async () => ({}) as CampusMapModule),
        projectId,
        signal: new AbortController().signal,
      },
    );
    prepared.tilesets.forEach(releasePreparedTilesetImage);
    return prepared;
  }

  it("reloads only consumed tileset images and reports their progress", async () => {
    const prepared = await consumedPreparedMap();
    const loadImage = vi.fn<
      (url: string, signal: AbortSignal) => Promise<ImageBitmap>
    >(async () => ({ close: vi.fn() }) as unknown as ImageBitmap);
    const onProgress = vi.fn();

    const rehydrated = await rehydratePreparedCampusMap(prepared, {
      loadImage,
      onProgress,
      signal: new AbortController().signal,
    });

    expect(loadImage.mock.calls.map(([url]) => url)).toEqual(
      prepared.tilesets.map(({ image }) => image),
    );
    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { completed: 0, stage: "tilesets", total: 3 },
      { completed: 1, stage: "tilesets", total: 3 },
      { completed: 2, stage: "tilesets", total: 3 },
      { completed: 3, stage: "tilesets", total: 3 },
    ]);
    expect(isPreparedCampusMapRenderReady(rehydrated)).toBe(true);
    expect(rehydrated.kaplayModule).toBe(prepared.kaplayModule);
  });

  it("releases decoded images when rehydration is cancelled", async () => {
    const prepared = await consumedPreparedMap();
    const controller = new AbortController();
    const close = vi.fn();
    const loadImage = vi
      .fn<(url: string, signal: AbortSignal) => Promise<ImageBitmap>>()
      .mockResolvedValueOnce({ close } as unknown as ImageBitmap)
      .mockImplementation(
        (_url, signal) =>
          new Promise<ImageBitmap>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          }),
      );

    const rehydration = rehydratePreparedCampusMap(prepared, {
      loadImage,
      signal: controller.signal,
    });

    await vi.waitFor(() => {
      expect(loadImage).toHaveBeenCalledTimes(mapFixture.tilesets.length);
    });
    controller.abort();

    await expect(rehydration).rejects.toMatchObject({ name: "AbortError" });
    expect(close).toHaveBeenCalledOnce();
  });
});
