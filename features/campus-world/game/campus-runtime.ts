import type { GameObj, KAPLAYCtx } from "kaplay";

import type { Presence } from "@/core/presence";

import { spawnCamera } from "../services/camera";
import {
  type CampusMapIdentity,
  type CampusMapModule,
  type PreparedCampusMap,
  takePreparedTilesetImages,
} from "../services/map/prepare-campus-map";
import { campusBackground } from "../services/theme-background";
import { addAvatarLayer } from "./avatar-layer";
import { addMapBand, type RenderTileset } from "./map-renderer";
import { uploadTilesetSprites } from "./tileset-sprites";

export interface CampusGame {
  stop: () => void;
}

export interface CampusGameOptions {
  onRenderError: () => void;
  readPresence: () => Presence;
  signal: AbortSignal;
}

export interface CampusRuntime {
  holdsMap: (map: CampusMapIdentity) => boolean;
  start: (
    container: HTMLElement,
    prepared: PreparedCampusMap,
    options: CampusGameOptions,
  ) => Promise<CampusGame>;
}

interface RuntimeContext {
  broken: boolean;
  canvas: HTMLCanvasElement;
  heldMaps: Set<string>;
  k: KAPLAYCtx;
  sprites: Map<string, Promise<RenderTileset[]>>;
}

interface Mount {
  objects: GameObj[];
  onRenderError: () => void;
  ready: boolean;
  rejectFirstDraw?: (error: Error) => void;
  renderError?: Error;
  stopped: boolean;
}

function mapKey({ mapId, version }: CampusMapIdentity): string {
  return `${mapId}@${version}`;
}

function readThemeBackground(): string {
  return campusBackground(getComputedStyle(document.documentElement));
}

function stoppedError(): DOMException {
  return new DOMException("The campus game stopped.", "AbortError");
}

function closeImages(images: Array<ImageBitmap | undefined>) {
  images.forEach((image) => image?.close());
}

export function createCampusRuntime(
  readBackground: () => string = readThemeBackground,
): CampusRuntime {
  let context: RuntimeContext | undefined;
  let active: Mount | undefined;

  function reportRenderError(error: Error) {
    const mount = active;
    if (!mount || mount.renderError) return;

    mount.renderError = error;
    if (mount.ready) {
      mount.onRenderError();
    } else {
      mount.rejectFirstDraw?.(error);
    }
  }

  function createContext(
    kaplayModule: CampusMapModule,
    container: HTMLElement,
  ): RuntimeContext {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    container.append(canvas);

    let k: KAPLAYCtx;
    try {
      k = kaplayModule.default({
        background: readBackground(),
        canvas,
        crisp: true,
        debug: process.env.NODE_ENV !== "production",
        focus: false,
        global: false,
        loadingScreen: false,
        root: container,
      });
    } catch (error) {
      canvas.remove();
      throw error;
    }
    canvas.tabIndex = -1;
    k.setLayers(["below", "avatars", "above"], "below");

    const created: RuntimeContext = {
      broken: false,
      canvas,
      heldMaps: new Set(),
      k,
      sprites: new Map(),
    };
    k.onError((error) => {
      created.broken = true;
      if (created === context) reportRenderError(error);
    });
    return created;
  }

  function contextFor(
    kaplayModule: CampusMapModule,
    container: HTMLElement,
  ): RuntimeContext {
    if (context && !context.broken) {
      container.append(context.canvas);
      return context;
    }

    if (context) {
      // A failed frame swaps KAPLAY's loop for an error screen that quit()
      // never stops. `_k` is KAPLAY's module state, so this reaches the broken
      // context's app only because that context was the last one created.
      context.k._k.app.quit();
      context.canvas.remove();
    }
    context = createContext(kaplayModule, container);
    return context;
  }

  function spritesFor(
    runtimeContext: RuntimeContext,
    prepared: PreparedCampusMap,
    images: Array<ImageBitmap | undefined>,
  ): Promise<RenderTileset[]> {
    const key = mapKey(prepared.manifest);
    const uploaded = runtimeContext.sprites.get(key);

    if (uploaded) {
      closeImages(images);
      return uploaded;
    }

    const upload = uploadTilesetSprites(
      runtimeContext.k,
      prepared.tilesets,
      images,
      `campus-tileset-${key}`,
    );
    runtimeContext.sprites.set(key, upload);
    void upload.then(
      () => runtimeContext.heldMaps.add(key),
      () => {
        runtimeContext.broken = true;
        runtimeContext.sprites.delete(key);
      },
    );
    return upload;
  }

  function drawMap(
    k: KAPLAYCtx,
    mount: Mount,
    prepared: PreparedCampusMap,
    tilesets: RenderTileset[],
    readPresence: () => Presence,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      mount.rejectFirstDraw = reject;
      if (mount.renderError) {
        reject(mount.renderError);
        return;
      }

      const camera = spawnCamera(prepared.map, prepared.layout, {
        height: k.height(),
        width: k.width(),
      });
      k.setCamPos(k.vec2(camera.x, camera.y));

      const band = { map: prepared.map, tilesets };
      mount.objects.push(
        addMapBand(k, {
          ...band,
          layer: "below",
          layers: prepared.bands.below,
        }),
      );
      mount.objects.push(
        addAvatarLayer(k, { map: prepared.map, readPresence }),
      );
      mount.objects.push(
        addMapBand(k, {
          ...band,
          layer: "above",
          layers: prepared.bands.above,
          onDraw: () => resolve(),
        }),
      );
    });
  }

  function stop(mount: Mount) {
    if (mount.stopped) return;

    mount.stopped = true;
    mount.objects.forEach((object) => object.destroy());
    mount.objects = [];
    mount.rejectFirstDraw?.(stoppedError());

    if (active === mount) {
      active = undefined;
      context?.canvas.remove();
    }
  }

  return {
    holdsMap(manifest) {
      return Boolean(
        context && !context.broken && context.heldMaps.has(mapKey(manifest)),
      );
    },

    async start(container, prepared, { onRenderError, readPresence, signal }) {
      if (active) stop(active);

      const mount: Mount = {
        objects: [],
        onRenderError,
        ready: false,
        stopped: false,
      };
      active = mount;
      const images = takePreparedTilesetImages(prepared);
      const stopOnAbort = () => stop(mount);
      signal.addEventListener("abort", stopOnAbort, { once: true });

      try {
        const runtimeContext = contextFor(prepared.kaplayModule, container);
        const tilesets = await spritesFor(runtimeContext, prepared, images);
        if (mount.stopped) throw stoppedError();

        await drawMap(
          runtimeContext.k,
          mount,
          prepared,
          tilesets,
          readPresence,
        );
        if (mount.renderError) throw mount.renderError;
        mount.ready = true;
        return { stop: () => stop(mount) };
      } catch (error) {
        closeImages(images);
        stop(mount);
        throw error;
      } finally {
        signal.removeEventListener("abort", stopOnAbort);
      }
    },
  };
}

export const campusRuntime = createCampusRuntime();
