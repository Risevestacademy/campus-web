export interface TiledTileLayer {
  data: number[];
  height: number;
  name?: string;
  offsetx?: number;
  offsety?: number;
  opacity?: number;
  type: "tilelayer";
  visible?: boolean;
  width: number;
  x?: number;
  y?: number;
}

interface TiledGroupLayer {
  layers: TiledLayer[];
  name?: string;
  type: "group";
  visible?: boolean;
}

interface TiledOtherLayer {
  name?: string;
  type?: string;
  visible?: boolean;
}

export type TiledLayer = TiledGroupLayer | TiledOtherLayer | TiledTileLayer;

export interface LayerBands {
  above: TiledTileLayer[];
  below: TiledTileLayer[];
}

function isTileLayer(layer: TiledLayer): layer is TiledTileLayer {
  return layer.type === "tilelayer" && "data" in layer;
}

export function splitLayerBands(map: { layers?: TiledLayer[] }): LayerBands {
  const bands: LayerBands = { above: [], below: [] };
  let aboveAvatars = false;

  function visit(layers: TiledLayer[], hidden: boolean): void {
    for (const layer of layers) {
      const isHidden = hidden || layer.visible === false;

      if ("layers" in layer) {
        visit(layer.layers, isHidden);
        continue;
      }

      if (isHidden || !isTileLayer(layer)) {
        continue;
      }

      if (layer.name === "avatars") {
        aboveAvatars = true;
        continue;
      }

      bands[aboveAvatars ? "above" : "below"].push(layer);
    }
  }

  visit(map.layers ?? [], false);
  return bands;
}
