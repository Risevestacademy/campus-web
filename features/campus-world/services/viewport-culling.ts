interface TileGrid {
  height: number;
  tileheight: number;
  tilewidth: number;
  width: number;
}

interface TileLayerPlacement {
  offsetx?: number;
  offsety?: number;
}

interface RenderedTileset {
  tileheight: number;
  tileoffset?: { x?: number; y?: number };
  tilewidth: number;
}

interface Viewport {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface TileBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface CullingPadding {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface TileViewportCullerOptions {
  layers: TileLayerPlacement[];
  map: TileGrid;
  tilesets: RenderedTileset[];
}

function tilePadding(
  map: TileGrid,
  layer: TileLayerPlacement,
  tileset: RenderedTileset,
): CullingPadding {
  const halfExtent = Math.max(tileset.tileheight, tileset.tilewidth) / 2;
  const centerX =
    map.tilewidth / 2 + (layer.offsetx ?? 0) + (tileset.tileoffset?.x ?? 0);
  const centerY =
    map.tileheight -
    tileset.tileheight / 2 +
    (layer.offsety ?? 0) +
    (tileset.tileoffset?.y ?? 0);

  return {
    bottom: Math.max(0, centerY + halfExtent - map.tileheight),
    left: Math.max(0, halfExtent - centerX),
    right: Math.max(0, centerX + halfExtent - map.tilewidth),
    top: Math.max(0, halfExtent - centerY),
  };
}

function mergePadding(
  current: CullingPadding,
  candidate: CullingPadding,
): CullingPadding {
  return {
    bottom: Math.max(current.bottom, candidate.bottom),
    left: Math.max(current.left, candidate.left),
    right: Math.max(current.right, candidate.right),
    top: Math.max(current.top, candidate.top),
  };
}

function cullingPadding({
  layers,
  map,
  tilesets,
}: TileViewportCullerOptions): CullingPadding {
  let padding: CullingPadding = { bottom: 0, left: 0, right: 0, top: 0 };

  for (const layer of layers) {
    for (const tileset of tilesets) {
      padding = mergePadding(padding, tilePadding(map, layer, tileset));
    }
  }

  return padding;
}

function visibleTileBounds(
  map: TileGrid,
  padding: CullingPadding,
  viewport: Viewport,
): TileBounds {
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;

  return {
    bottom: Math.min(
      map.height - 1,
      Math.ceil((viewport.y + halfHeight + padding.top) / map.tileheight),
    ),
    left: Math.max(
      0,
      Math.floor((viewport.x - halfWidth - padding.right) / map.tilewidth),
    ),
    right: Math.min(
      map.width - 1,
      Math.ceil((viewport.x + halfWidth + padding.left) / map.tilewidth),
    ),
    top: Math.max(
      0,
      Math.floor((viewport.y - halfHeight - padding.bottom) / map.tileheight),
    ),
  };
}

export function createTileViewportCuller(
  options: TileViewportCullerOptions,
): (viewport: Viewport) => TileBounds {
  const padding = cullingPadding(options);

  return (viewport) => visibleTileBounds(options.map, padding, viewport);
}
