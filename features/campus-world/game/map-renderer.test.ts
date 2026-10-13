import { describe, expect, it } from "vitest";

import {
  addFakeBand,
  renderTilesets,
  squareLayer,
} from "../testing/fake-kaplay-band";

const tilesets = renderTilesets(["grounds", "terrains"]);

describe("addMapBand", () => {
  it("draws a lower layer before an upper layer from an earlier tileset", () => {
    const band = addFakeBand(
      [squareLayer([11, 0, 0, 0]), squareLayer([1, 0, 0, 0])],
      tilesets,
    );

    expect(band.drawFrame()).toEqual(["terrains", "grounds"]);
  });

  it("draws each visible tile exactly once per frame", () => {
    const band = addFakeBand(
      [squareLayer([1, 11, 0, 2]), squareLayer([0, 0, 12, 0])],
      tilesets,
    );

    band.drawFrame();
    expect(band.drawSprite).toHaveBeenCalledTimes(4);

    band.drawSprite.mockClear();
    band.drawFrame();
    expect(band.drawSprite).toHaveBeenCalledTimes(4);
  });

  it("draws a tall tile whose base cell is below the viewport", () => {
    const band = addFakeBand(
      [squareLayer([0, 0, 0, 0, 0, 0, 1, 0, 0])],
      [{ ...tilesets[0]!, tileheight: 46 }],
      {
        camera: { x: 8, y: 8 },
        viewport: { height: 16, width: 16 },
      },
    );

    expect(band.drawFrame()).toEqual(["grounds"]);
  });
});
