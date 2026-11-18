import { describe, expect, it } from "vitest";

import { createTileViewportCuller } from "./viewport-culling";

const map = {
  height: 5,
  tileheight: 16,
  tilewidth: 16,
  width: 5,
};
const viewport = { height: 16, width: 16, x: 40, y: 40 };

describe("createTileViewportCuller", () => {
  it("includes base cells reached by an oversized sprite", () => {
    const visibleBounds = createTileViewportCuller({
      layers: [{}],
      map,
      tilesets: [{ tileheight: 46, tilewidth: 16 }],
    });

    expect(visibleBounds(viewport)).toEqual({
      bottom: 4,
      left: 1,
      right: 4,
      top: 2,
    });
  });

  it("includes layer and tileset offsets in rendered reach", () => {
    const visibleBounds = createTileViewportCuller({
      layers: [{ offsetx: 9, offsety: 9 }],
      map,
      tilesets: [
        {
          tileheight: 16,
          tileoffset: { x: 8, y: 8 },
          tilewidth: 16,
        },
      ],
    });

    expect(visibleBounds(viewport)).toEqual({
      bottom: 3,
      left: 0,
      right: 3,
      top: 0,
    });
  });
});
