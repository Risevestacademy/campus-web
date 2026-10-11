import { describe, expect, it, vi } from "vitest";

import type {
  CampusMapModule,
  PreparedCampusMap,
} from "../services/map/prepare-campus-map";
import { startCampusGame } from "./start-campus-game";

function kaplayContext(
  spriteSources: unknown[],
  beforeSpriteLoad?: () => void,
) {
  const context = {
    add: vi.fn((components: unknown[]) => {
      const drawable = components.find(
        (component): component is { draw: () => void } =>
          typeof component === "object" &&
          component !== null &&
          "draw" in component,
      );
      drawable?.draw();
    }),
    drawSprite: vi.fn(),
    getCamPos: vi.fn(() => ({ x: 0, y: 0 })),
    height: vi.fn(() => 480),
    layer: vi.fn((name: string) => ({ name })),
    loadSprite: vi.fn((_name: string, source: unknown) => {
      spriteSources.push(source);
      const loading = {
        onError: vi.fn(() => loading),
        onLoad: vi.fn((callback: () => void) => {
          beforeSpriteLoad?.();
          callback();
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

  return context;
}

describe("startCampusGame", () => {
  it("transfers every decoded image before awaiting the first sprite upload", async () => {
    const spriteSources: unknown[] = [];
    const firstImage = { close: vi.fn() } as unknown as ImageBitmap;
    const secondImage = { close: vi.fn() } as unknown as ImageBitmap;
    let cachedImagesDuringFirstUpload: Array<ImageBitmap | undefined> = [];
    const kaplay = vi.fn(() =>
      kaplayContext(spriteSources, () => {
        if (cachedImagesDuringFirstUpload.length === 0) {
          cachedImagesDuringFirstUpload = prepared.tilesets.map(
            ({ decodedImage }) => decodedImage,
          );
        }
      }),
    );
    const prepared = {
      bands: { above: [], below: [] },
      kaplayModule: { default: kaplay } as unknown as CampusMapModule,
      layout: {},
      manifest: { mapId: "campus" },
      map: {
        height: 10,
        tileheight: 16,
        tilewidth: 16,
        width: 10,
      },
      tilesets: [
        {
          decodedImage: firstImage,
          firstgid: 1,
          frames: [{ h: 1, w: 1, x: 0, y: 0 }],
          image: "https://cdn.example/first.png",
          lastgid: 1,
          name: "first",
          tileheight: 16,
          tilewidth: 16,
        },
        {
          decodedImage: secondImage,
          firstgid: 2,
          frames: [{ h: 1, w: 1, x: 0, y: 0 }],
          image: "https://cdn.example/second.png",
          lastgid: 2,
          name: "second",
          tileheight: 16,
          tilewidth: 16,
        },
      ],
    } as unknown as PreparedCampusMap;

    await startCampusGame(
      document.createElement("div"),
      document.createElement("canvas"),
      prepared,
      { onRenderError: vi.fn() },
    );

    expect(cachedImagesDuringFirstUpload).toEqual([undefined, undefined]);
    expect(spriteSources).toEqual([firstImage, secondImage]);
    expect(firstImage.close).toHaveBeenCalledOnce();
    expect(secondImage.close).toHaveBeenCalledOnce();
  });

  it("releases an uploaded decoded tileset and falls back to its URL on remount", async () => {
    const close = vi.fn();
    const decodedImage = { close } as unknown as ImageBitmap;
    const spriteSources: unknown[] = [];
    const kaplay = vi.fn(() => kaplayContext(spriteSources));
    const prepared = {
      bands: { above: [], below: [] },
      kaplayModule: { default: kaplay } as unknown as CampusMapModule,
      layout: {},
      manifest: { mapId: "campus" },
      map: {
        height: 10,
        tileheight: 16,
        tilewidth: 16,
        width: 10,
      },
      tilesets: [
        {
          decodedImage,
          firstgid: 1,
          frames: [{ h: 1, w: 1, x: 0, y: 0 }],
          image: "https://cdn.example/campus.png",
          lastgid: 1,
          name: "campus",
          tileheight: 16,
          tilewidth: 16,
        },
      ],
    } as unknown as PreparedCampusMap;
    const container = document.createElement("div");

    await startCampusGame(
      container,
      document.createElement("canvas"),
      prepared,
      { onRenderError: vi.fn() },
    );

    expect(spriteSources[0]).toBe(decodedImage);
    expect(close).toHaveBeenCalledOnce();
    expect(prepared.tilesets[0]?.decodedImage).toBeUndefined();

    await startCampusGame(
      container,
      document.createElement("canvas"),
      prepared,
      { onRenderError: vi.fn() },
    );

    expect(spriteSources[1]).toBe("https://cdn.example/campus.png");
    expect(close).toHaveBeenCalledOnce();
  });
});
