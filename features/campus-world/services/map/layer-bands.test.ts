import { describe, expect, it } from "vitest";

import { splitLayerBands } from "./layer-bands";

function tileLayer(name: string, visible = true) {
  return {
    data: [1],
    height: 1,
    name,
    type: "tilelayer" as const,
    visible,
    width: 1,
  };
}

describe("splitLayerBands", () => {
  it("walks groups depth-first and splits visible tile layers at avatars", () => {
    const ground = tileLayer("ground");
    const chairs = tileLayer("chairs");
    const avatars = tileLayer("avatars");
    const walls = tileLayer("walls");
    const trees = tileLayer("trees");

    expect(
      splitLayerBands({
        layers: [
          ground,
          {
            layers: [chairs, avatars, walls],
            name: "furniture",
            type: "group",
          },
          trees,
        ],
      }),
    ).toEqual({ below: [ground, chairs], above: [walls, trees] });
  });

  it("skips tile layers inside hidden groups", () => {
    const ground = tileLayer("ground");
    const hiddenAvatars = tileLayer("avatars");
    const hiddenWalls = tileLayer("walls");
    const trees = tileLayer("trees");

    expect(
      splitLayerBands({
        layers: [
          ground,
          {
            layers: [hiddenAvatars, hiddenWalls],
            name: "draft",
            type: "group",
            visible: false,
          },
          trees,
        ],
      }),
    ).toEqual({ below: [ground, trees], above: [] });
  });

  it("puts every visible tile layer below when the marker is absent", () => {
    const ground = tileLayer("ground");
    const trees = tileLayer("trees");

    expect(splitLayerBands({ layers: [ground, trees] })).toEqual({
      below: [ground, trees],
      above: [],
    });
  });
});
