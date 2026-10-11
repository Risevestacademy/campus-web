import { clampCamera } from "../services/camera";
import { takePreparedTilesetImages } from "../services/map/prepare-campus-map";
import type { CampusGame, StartCampusGame } from "./campus-game.types";
import { addMapBand, type RenderTileset } from "./map-renderer";

const CAMPUS_BACKGROUND = "#e9ecf6";

export const startCampusGame: StartCampusGame = async (
  container,
  canvas,
  prepared,
  dependencies,
): Promise<CampusGame> => {
  const { default: kaplay } = prepared.kaplayModule;
  const k = kaplay({
    background: CAMPUS_BACKGROUND,
    canvas,
    crisp: true,
    debug: process.env.NODE_ENV !== "production",
    focus: false,
    global: false,
    loadingScreen: false,
    root: container,
  });
  canvas.tabIndex = -1;

  let ready = false;
  let rejectFirstDraw: ((error: Error) => void) | undefined;
  k.onError((error) => {
    if (ready) {
      dependencies.onRenderError(prepared.manifest.mapId);
      return;
    }
    rejectFirstDraw?.(error);
  });

  const preparedImages = takePreparedTilesetImages(prepared);

  try {
    k.setLayers(["below", "avatars", "above"], "below");

    const renderTilesets: RenderTileset[] = [];
    for (const [index, tileset] of prepared.tilesets.entries()) {
      const spriteName = `campus-tileset-${tileset.firstgid}`;
      const preparedImage = preparedImages[index];
      await new Promise<void>((resolve, reject) => {
        k.loadSprite(spriteName, preparedImage ?? tileset.image, {
          frames: tileset.frames.map(({ h, w, x, y }) => k.quad(x, y, w, h)),
        })
          .onLoad(() => resolve())
          .onError(reject);
      });
      preparedImage?.close();
      preparedImages[index] = undefined;
      renderTilesets.push({
        firstgid: tileset.firstgid,
        lastgid: tileset.lastgid,
        name: tileset.name,
        spriteName,
        tileheight: tileset.tileheight,
        tileoffset: tileset.tileoffset,
        tilewidth: tileset.tilewidth,
      });
    }

    const target = prepared.layout.spawn
      ? {
          x: (prepared.layout.spawn.x + 0.5) * prepared.map.tilewidth,
          y: (prepared.layout.spawn.y + 0.5) * prepared.map.tileheight,
        }
      : {
          x: (prepared.map.width * prepared.map.tilewidth) / 2,
          y: (prepared.map.height * prepared.map.tileheight) / 2,
        };
    const camera = clampCamera(
      target,
      { height: k.height(), width: k.width() },
      {
        height: prepared.map.height * prepared.map.tileheight,
        width: prepared.map.width * prepared.map.tilewidth,
      },
    );
    k.setCamPos(k.vec2(camera.x, camera.y));

    addMapBand(k, prepared, prepared.bands.below, renderTilesets, "below");

    await new Promise<void>((resolve, reject) => {
      rejectFirstDraw = reject;
      let firstDrawn = false;
      addMapBand(
        k,
        prepared,
        prepared.bands.above,
        renderTilesets,
        "above",
        () => {
          if (firstDrawn) return;
          firstDrawn = true;
          resolve();
        },
      );
    });

    ready = true;
    return { quit: () => k.quit() };
  } catch (error) {
    preparedImages.forEach((image) => image?.close());
    k.quit();
    throw error;
  }
};
