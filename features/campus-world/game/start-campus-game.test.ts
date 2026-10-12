import { describe, expect, it, vi } from "vitest";

import type {
  CampusMapModule,
  PreparedCampusMap,
} from "../services/map/prepare-campus-map";
import { fakeImage } from "../testing/sanity-map-fixture";
import { startCampusGame } from "./start-campus-game";

interface SpriteUpload {
  finish: () => void;
  source: unknown;
}

function kaplayContext(onUpload: (upload: SpriteUpload) => void) {
  return {
    add: vi.fn((components: Array<{ draw?: () => void }>) => {
      components.find((component) => component.draw)?.draw?.();
    }),
    drawSprite: vi.fn(),
    getCamPos: vi.fn(() => ({ x: 0, y: 0 })),
    height: vi.fn(() => 480),
    layer: vi.fn((name: string) => ({ name })),
    loadSprite: vi.fn((_name: string, source: unknown) => {
      const loading = {
        onError: vi.fn(() => loading),
        onLoad: vi.fn((callback: () => void) => {
          onUpload({ finish: callback, source });
          return loading;
        }),
      };
      return loading;
    }),
    onError: vi.fn(),
    quad: vi.fn(() => ({})),
    quit: vi.fn(),
    setCamPos: vi.fn(),
    setLayers: vi.fn(),
    vec2: vi.fn((x: number, y: number) => ({ x, y })),
    width: vi.fn(() => 640),
  };
}

const finishImmediately = (upload: SpriteUpload) => upload.finish();

function preparedMap(
  decodedImages: Array<ImageBitmap | undefined>,
  onUpload: (upload: SpriteUpload) => void = finishImmediately,
): PreparedCampusMap {
  const kaplay = vi.fn(() => kaplayContext(onUpload));

  return {
    bands: { above: [], below: [] },
    kaplayModule: { default: kaplay } as unknown as CampusMapModule,
    layout: {},
    manifest: { mapId: "campus" },
    map: { height: 10, tileheight: 16, tilewidth: 16, width: 10 },
    tilesets: decodedImages.map((decodedImage, index) => ({
      decodedImage,
      firstgid: index + 1,
      frames: [{ h: 1, w: 1, x: 0, y: 0 }],
      image: `https://cdn.example/tileset-${index}.png`,
      lastgid: index + 1,
      name: `tileset-${index}`,
      tileheight: 16,
      tilewidth: 16,
    })),
  } as unknown as PreparedCampusMap;
}

function start(prepared: PreparedCampusMap) {
  return startCampusGame(
    document.createElement("div"),
    document.createElement("canvas"),
    prepared,
    { onRenderError: vi.fn() },
  );
}

describe("startCampusGame", () => {
  it("takes every decoded image before awaiting the first sprite upload", async () => {
    const images = [fakeImage(), fakeImage()];
    const sources: unknown[] = [];
    let cachedDuringFirstUpload: Array<ImageBitmap | undefined> | undefined;
    const prepared: PreparedCampusMap = preparedMap(images, (upload) => {
      cachedDuringFirstUpload ??= prepared.tilesets.map(
        ({ decodedImage }) => decodedImage,
      );
      sources.push(upload.source);
      upload.finish();
    });

    await start(prepared);

    expect(cachedDuringFirstUpload).toEqual([undefined, undefined]);
    expect(sources).toEqual(images);
    images.forEach((image) => expect(image.close).toHaveBeenCalledOnce());
  });

  it("requests every sprite upload before any finishes", async () => {
    const uploads: SpriteUpload[] = [];
    const game = start(
      preparedMap([undefined, undefined, undefined], (upload) => {
        uploads.push(upload);
      }),
    );

    await vi.waitFor(() => expect(uploads).toHaveLength(3));
    uploads.forEach((upload) => upload.finish());

    await expect(game).resolves.toEqual({ quit: expect.any(Function) });
  });

  it("falls back to the tileset URL once its decoded image was uploaded", async () => {
    const image = fakeImage();
    const sources: unknown[] = [];
    const prepared = preparedMap([image], (upload) => {
      sources.push(upload.source);
      upload.finish();
    });

    await start(prepared);
    await start(prepared);

    expect(sources).toEqual([image, "https://cdn.example/tileset-0.png"]);
    expect(image.close).toHaveBeenCalledOnce();
  });
});
