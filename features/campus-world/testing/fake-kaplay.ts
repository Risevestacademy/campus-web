import type { KAPLAYCtx, KAPLAYOpt } from "kaplay";
import { vi } from "vitest";

import type {
  CampusMapModule,
  PreparedCampusMap,
} from "../services/map/prepare-campus-map";

export interface FakeSpriteUpload {
  fail: (error?: Error) => void;
  finish: () => void;
  name: string;
  source: unknown;
}

interface FakeKaplaySettings {
  autoDraw?: boolean;
  autoUpload?: boolean;
}

interface FakeObject {
  destroy: () => void;
  draw?: () => void;
  update?: () => void;
}

function createContext(
  options: KAPLAYOpt,
  { autoDraw = true, autoUpload = true }: FakeKaplaySettings,
  uploads: FakeSpriteUpload[],
) {
  const objects = new Set<FakeObject>();
  const errorHandlers: Array<(error: Error) => void> = [];
  const stopLoop = vi.fn();

  const k = {
    _k: { app: { quit: stopLoop } },
    add: vi.fn(
      (components: Array<{ draw?: () => void; update?: () => void }>) => {
        const object: FakeObject = {
          destroy: () => objects.delete(object),
          draw: components.find((component) => component.draw)?.draw,
          update: components.find((component) => component.update)?.update,
        };
        objects.add(object);
        if (autoDraw) object.draw?.();
        return object;
      },
    ),
    drawCircle: vi.fn(),
    drawFormattedText: vi.fn(),
    drawSprite: vi.fn(),
    formatText: vi.fn((options: { text: string }) => ({ text: options.text })),
    getCamPos: vi.fn(() => ({ x: 0, y: 0 })),
    height: vi.fn(() => 480),
    layer: vi.fn((name: string) => ({ name })),
    loadSprite: vi.fn((name: string, source: unknown) => {
      let onLoad: (() => void) | undefined;
      let onError: ((error: Error) => void) | undefined;
      const asset = {
        onError(callback: (error: Error) => void) {
          onError = callback;
          return asset;
        },
        onLoad(callback: () => void) {
          onLoad = callback;
          return asset;
        },
      };
      const upload: FakeSpriteUpload = {
        fail: (error = new Error("The sprite upload failed.")) =>
          onError?.(error),
        finish: () => onLoad?.(),
        name,
        source,
      };
      uploads.push(upload);
      if (autoUpload) queueMicrotask(upload.finish);
      return asset;
    }),
    onError: vi.fn((handler: (error: Error) => void) => {
      errorHandlers.push(handler);
    }),
    popTransform: vi.fn(),
    pushTransform: vi.fn(),
    pushTranslate: vi.fn(),
    quad: vi.fn(() => ({})),
    quit: vi.fn(),
    rgb: vi.fn((hex: string) => hex),
    setCamPos: vi.fn(),
    setLayers: vi.fn(),
    vec2: vi.fn((x: number, y: number) => ({ x, y })),
    width: vi.fn(() => 640),
  };

  return {
    drawFrame: () => objects.forEach((object) => object.draw?.()),
    updateFrame: () => objects.forEach((object) => object.update?.()),
    failFrame: (error = new Error("A frame failed.")) =>
      errorHandlers.forEach((handler) => handler(error)),
    k: k as unknown as KAPLAYCtx,
    liveObjects: () => objects.size,
    options,
    stopLoop,
  };
}

export type FakeKaplayContext = ReturnType<typeof createContext>;

export function fakeKaplay(settings: FakeKaplaySettings = {}) {
  const contexts: FakeKaplayContext[] = [];
  const uploads: FakeSpriteUpload[] = [];
  const kaplay = vi.fn((options: KAPLAYOpt) => {
    const context = createContext(options, settings, uploads);
    contexts.push(context);
    return context.k;
  });

  return {
    contexts,
    kaplay,
    module: { default: kaplay } as unknown as CampusMapModule,
    uploads,
  };
}

export function fakePreparedMap(
  kaplayModule: CampusMapModule,
  {
    images = [undefined, undefined],
    version = "version-1",
  }: { images?: Array<ImageBitmap | undefined>; version?: string } = {},
): PreparedCampusMap {
  return {
    bands: { above: [], below: [] },
    kaplayModule,
    layout: { spawn: null },
    manifest: { mapId: "campus", version },
    map: { height: 10, tileheight: 16, tilewidth: 16, width: 10 },
    preparationMs: 0,
    tilesets: images.map((decodedImage, index) => ({
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
