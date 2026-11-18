import type { KAPLAYCtx } from "kaplay";

import type { PreparedTileset } from "../services/map/prepare-campus-map";
import type { RenderTileset } from "./map-renderer";

export function uploadTilesetSprites(
  k: KAPLAYCtx,
  tilesets: PreparedTileset[],
  images: Array<ImageBitmap | undefined>,
  spritePrefix: string,
): Promise<RenderTileset[]> {
  return Promise.all(
    tilesets.map(async (tileset, index): Promise<RenderTileset> => {
      const spriteName = `${spritePrefix}-${tileset.firstgid}`;
      const image = images[index];

      try {
        await new Promise<void>((resolve, reject) => {
          k.loadSprite(spriteName, image ?? tileset.image, {
            frames: tileset.frames.map(({ h, w, x, y }) => k.quad(x, y, w, h)),
          })
            .onLoad(() => resolve())
            .onError(reject);
        });
      } finally {
        image?.close();
        images[index] = undefined;
      }

      return {
        firstgid: tileset.firstgid,
        lastgid: tileset.lastgid,
        name: tileset.name,
        spriteName,
        tileheight: tileset.tileheight,
        tileoffset: tileset.tileoffset,
        tilewidth: tileset.tilewidth,
      };
    }),
  );
}
