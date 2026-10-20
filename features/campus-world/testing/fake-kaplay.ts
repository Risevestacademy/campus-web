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

interface Point {
  x: number;
  y: number;
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
  const downKeys = new Set<string>();
  const errorHandlers: Array<(error: Error) => void> = [];
  const pressedKeys = new Set<string>();
  const keyPressHandlers = new Set<(key: string) => void>();
  const scrollHandlers = new Set<(delta: Point) => void>();
  const stopLoop = vi.fn();
  let deltaSeconds = 0;
  let camPos: Point = { x: 0, y: 0 };
  let camScale = 1;
  let mouse: Point = { x: 0, y: 0 };
  let viewport = { height: 480, width: 640 };

  function listen<Handler>(handlers: Set<Handler>, handler: Handler) {
    handlers.add(handler);
    return { cancel: () => handlers.delete(handler) };
  }

  function readsKey(keys: string | string[] | undefined, state: Set<string>) {
    if (keys === undefined) return state.size > 0;
    return Array.isArray(keys)
      ? keys.some((key) => state.has(key))
      : state.has(keys);
  }

  const k = {
    _k: { app: { quit: stopLoop } },
    add: vi.fn(
      (
        components: Array<{
          destroy?: () => void;
          draw?: () => void;
          update?: () => void;
        }>,
      ) => {
        const onDestroy = components.find(
          (component) => component.destroy,
        )?.destroy;
        const object: FakeObject = {
          destroy: () => {
            onDestroy?.();
            objects.delete(object);
          },
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
    dt: vi.fn(() => deltaSeconds),
    formatText: vi.fn((options: { text: string }) => ({ text: options.text })),
    getCamPos: vi.fn(() => camPos),
    getCamScale: vi.fn(() => ({ x: camScale, y: camScale })),
    height: vi.fn(() => viewport.height),
    isKeyDown: vi.fn((keys?: string | string[]) => readsKey(keys, downKeys)),
    isKeyPressed: vi.fn((keys?: string | string[]) =>
      readsKey(keys, pressedKeys),
    ),
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
    mousePos: vi.fn(() => mouse),
    onError: vi.fn((handler: (error: Error) => void) => {
      errorHandlers.push(handler);
    }),
    onKeyPress: vi.fn((handler: (key: string) => void) =>
      listen(keyPressHandlers, handler),
    ),
    onScroll: vi.fn((handler: (delta: Point) => void) =>
      listen(scrollHandlers, handler),
    ),
    popTransform: vi.fn(),
    pushTransform: vi.fn(),
    pushTranslate: vi.fn(),
    quad: vi.fn(() => ({})),
    quit: vi.fn(),
    rgb: vi.fn((hex: string) => hex),
    setCamPos: vi.fn((position: Point) => {
      camPos = position;
    }),
    setCamScale: vi.fn((scale: number) => {
      camScale = scale;
    }),
    setLayers: vi.fn(),
    vec2: vi.fn((x: number, y: number) => ({ x, y })),
    width: vi.fn(() => viewport.width),
  };

  return {
    drawFrame: () => objects.forEach((object) => object.draw?.()),
    updateFrame: (deltaMs = 16) => {
      deltaSeconds = deltaMs / 1000;
      objects.forEach((object) => object.update?.());
      pressedKeys.clear();
    },
    failFrame: (error = new Error("A frame failed.")) =>
      errorHandlers.forEach((handler) => handler(error)),
    k: k as unknown as KAPLAYCtx,
    inputHandlers: () => keyPressHandlers.size + scrollHandlers.size,
    liveObjects: () => objects.size,
    moveMouse: (position: Point) => {
      mouse = position;
    },
    options,
    pressKey: (key: string) => {
      downKeys.add(key);
      pressedKeys.add(key);
      keyPressHandlers.forEach((handler) => handler(key));
    },
    releaseKey: (key: string) => downKeys.delete(key),
    resize: (width: number, height: number) => {
      viewport = { height, width };
    },
    scroll: (deltaY: number) =>
      scrollHandlers.forEach((handler) => handler({ x: 0, y: deltaY })),
    stopLoop,
  };
}

export type FakeKaplayContext = ReturnType<typeof createContext>;

export function fakeKaplay(settings: FakeKaplaySettings = {}) {
  const contexts: FakeKaplayContext[] = [];
  const uploads: FakeSpriteUpload[] = [];
  const kaplay = vi.fn((options: KAPLAYOpt) => {
    const context = createContext(options, settings, uploads);
    if (options.focus !== false) options.canvas?.focus();
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
