const FLIPPED_HORIZONTALLY = 0x80000000;
const FLIPPED_VERTICALLY = 0x40000000;
const FLIPPED_DIAGONALLY = 0x20000000;
const TILE_ID_BITS = 0x0fffffff;

export interface FrameSource {
  columns: number;
  imageheight: number;
  imagewidth: number;
  margin: number;
  spacing: number;
  tilecount: number;
  tileheight: number;
  tilewidth: number;
}

export interface SpriteFrame {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface TiledTileset extends FrameSource {
  firstgid: number;
  image: string;
  name: string;
  tileoffset?: { x?: number; y?: number };
}

export interface TilesetFrameTable extends TiledTileset {
  frames: SpriteFrame[];
  lastgid: number;
}

export interface DecodedTileGid {
  angle: 0 | 90 | 270;
  flipX: boolean;
  flipY: boolean;
  gid: number;
}

export function buildTilesetFrames(source: FrameSource): SpriteFrame[] {
  const { columns, margin, spacing, tileheight, tilewidth } = source;

  return Array.from({ length: source.tilecount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      h: tileheight / source.imageheight,
      w: tilewidth / source.imagewidth,
      x: (margin + column * (tilewidth + spacing)) / source.imagewidth,
      y: (margin + row * (tileheight + spacing)) / source.imageheight,
    };
  });
}

export function buildTilesetFrameTables(
  tilesets: TiledTileset[],
): TilesetFrameTable[] {
  return tilesets.map((tileset) => ({
    ...tileset,
    frames: buildTilesetFrames(tileset),
    lastgid: tileset.firstgid + tileset.tilecount - 1,
  }));
}

export function decodeTileGid(rawGid: number): DecodedTileGid {
  const unsignedGid = rawGid >>> 0;
  const horizontal = (unsignedGid & FLIPPED_HORIZONTALLY) !== 0;
  const vertical = (unsignedGid & FLIPPED_VERTICALLY) !== 0;
  const diagonal = (unsignedGid & FLIPPED_DIAGONALLY) !== 0;

  if (!diagonal) {
    return {
      angle: 0,
      flipX: horizontal,
      flipY: vertical,
      gid: unsignedGid & TILE_ID_BITS,
    };
  }

  if (horizontal && vertical) {
    return {
      angle: 90,
      flipX: true,
      flipY: false,
      gid: unsignedGid & TILE_ID_BITS,
    };
  }

  if (horizontal) {
    return {
      angle: 90,
      flipX: false,
      flipY: false,
      gid: unsignedGid & TILE_ID_BITS,
    };
  }

  if (vertical) {
    return {
      angle: 270,
      flipX: false,
      flipY: false,
      gid: unsignedGid & TILE_ID_BITS,
    };
  }

  return {
    angle: 270,
    flipX: true,
    flipY: false,
    gid: unsignedGid & TILE_ID_BITS,
  };
}
